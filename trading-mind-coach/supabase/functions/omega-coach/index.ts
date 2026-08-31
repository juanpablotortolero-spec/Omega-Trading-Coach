// El motor del agente Omega. Recibe el historial de chat + contexto del
// trader, corre el loop de tool-use de Anthropic, EJECUTA las tools
// server-side (Service Role — el navegador nunca escribe estas tablas
// directamente), y devuelve al navegador solo el texto final + un resumen de
// los efectos ya aplicados para que el hook actualice la UI.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Anthropic from 'https://esm.sh/@anthropic-ai/sdk@0.32.1';
import { corsHeaders } from '../_shared/cors.ts';
import { buildSystemPrompt, OMEGA_TOOLS, type OmegaContext } from '../_shared/omega.ts';

type InMessage = { role: 'user' | 'assistant'; content: string };

type Effects = {
  virtusDelta: number;
  missionsAssigned: { title: string; reward_xp: number }[];
  uiAlerts: { message: string; severity: 'info' | 'warning' | 'critical' }[];
  streakValidations: { description: string; bonus_xp: number }[];
  sessionVerdict: { ataraxia_score: number | null; verdict: string; went_well: string[]; went_wrong: string[] } | null;
  goalUpdates: { goalId: string; goalText: string; delta: number; newPct: number; reason: string }[];
  missionProgressUpdates: { missionId: string; missionTitle: string; newPct: number; reason: string }[];
  psychGrowth: { category: 'correccion' | 'fortaleza'; reason: string }[];
};

const MAX_TOOL_ITERATIONS = 5;
const MODEL = Deno.env.get('OMEGA_MODEL') || 'claude-sonnet-5';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ ok: false, error: 'No autenticado.' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!anthropicKey) {
      return new Response(JSON.stringify({ ok: false, error: 'Falta configurar ANTHROPIC_API_KEY.' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user },
      error: userError,
    } = await callerClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ ok: false, error: 'No autenticado.' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = (await req.json()) as { messages?: InMessage[]; context?: OmegaContext };
    const inMessages = body.messages ?? [];
    if (inMessages.length === 0) {
      return new Response(JSON.stringify({ ok: false, error: 'Falta el mensaje.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const context: OmegaContext = body.context ?? { virtusStage: 'LOGOS', virtusTotal: 0, ataraxiaPct: null };

    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const anthropic = new Anthropic({ apiKey: anthropicKey });

    // Rotación de misiones: soft-expire (no borrado, mantiene la memoria
    // conductual) de las misiones de assign_ai_mission que llevan más de 24hs
    // sin completarse. No toca las del Head Coach (llevan audit_date y ya
    // tienen su propio ciclo diario de borrado-e-inserción, ver más abajo).
    // Oportunista: corre en cada llamada a Omega, no hay cron en este repo.
    const expirationCutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { error: expireError } = await adminClient
      .from('ai_missions')
      .update({ expired_at: new Date().toISOString() })
      .eq('user_id', user.id)
      .eq('completed', false)
      .is('expired_at', null)
      .is('audit_date', null)
      .lt('created_at', expirationCutoff);
    if (expireError) throw expireError;

    const effects: Effects = {
      virtusDelta: 0,
      missionsAssigned: [],
      uiAlerts: [],
      streakValidations: [],
      sessionVerdict: null,
      goalUpdates: [],
      missionProgressUpdates: [],
      psychGrowth: [],
    };

    // deno-lint-ignore no-explicit-any
    const conversation: any[] = inMessages.map((m) => ({ role: m.role, content: m.content }));

    // Visión: si el hook mandó URLs de capturas reales, el ÚLTIMO mensaje de
    // usuario (el digest de sesión recién armado) pasa de string plano a un
    // array de bloques texto+imagen — la API de Anthropic acepta
    // source:{type:'url', url} directo, sin que el Edge Function tenga que
    // descargar/codificar nada.
    if (context.screenshotUrls && context.screenshotUrls.length > 0) {
      const lastIndex = conversation.length - 1;
      if (lastIndex >= 0 && conversation[lastIndex].role === 'user' && typeof conversation[lastIndex].content === 'string') {
        conversation[lastIndex] = {
          role: 'user',
          content: [
            { type: 'text', text: conversation[lastIndex].content },
            ...context.screenshotUrls.map((url) => ({ type: 'image', source: { type: 'url', url } })),
          ],
        };
      }
    }

    // El Head Coach, el Recap Semanal y el Cierre de Mes (OmegaDashboard)
    // exigen que la ÚNICA respuesta sea un JSON puro — si les dejamos tools
    // disponibles, el modelo podría desviarse a un tool_use en vez de texto.
    // Se omiten del todo para estas llamadas.
    const isHeadCoach = context.requestType === 'auditoria_head_coach';
    const isJsonOnlyMode = isHeadCoach || context.requestType === 'recap_semanal' || context.requestType === 'cierre_mensual';

    let finalText = '';
    for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration += 1) {
      const response = await anthropic.messages.create({
        model: MODEL,
        // Estos JSON traen varios arrays/campos largos — con digests reales
        // (Manual Operativo detallado, semana completa) 2048 no alcanza y la
        // respuesta se corta a mitad del JSON, rompiendo el parseo. La
        // Auditoría Mensual es la más extensa de todas (varios campos de
        // varias frases cada uno) — necesita más margen que el resto.
        max_tokens: context.requestType === 'cierre_mensual' ? 6144 : isJsonOnlyMode ? 4096 : 2048,
        system: buildSystemPrompt(context),
        ...(isJsonOnlyMode ? {} : { tools: OMEGA_TOOLS }),
        messages: conversation,
      });

      const textBlocks = response.content.filter((block) => block.type === 'text');
      finalText = textBlocks.map((block) => (block as { text: string }).text).join('\n').trim();

      if (response.stop_reason !== 'tool_use') break;

      // deno-lint-ignore no-explicit-any
      const toolUseBlocks = response.content.filter((block: any) => block.type === 'tool_use') as any[];

      conversation.push({ role: 'assistant', content: response.content });

      // deno-lint-ignore no-explicit-any
      const toolResults: any[] = [];
      for (const toolUse of toolUseBlocks) {
        const result = await runTool(adminClient, user.id, toolUse.name, toolUse.input, effects, context);
        toolResults.push({
          type: 'tool_result',
          tool_use_id: toolUse.id,
          content: JSON.stringify(result),
        });
      }
      conversation.push({ role: 'user', content: toolResults });
    }

    // El briefing pre-sesión pasa de efímero (sessionStorage) a persistido —
    // upsert por (user_id, briefing_date): si ya existía (el trader visitó
    // Dashboard y OmegaDashboard el mismo día), esto solo pisa `content`,
    // nunca toca `acknowledged_at` (no va en el payload), así que un
    // briefing ya leído no "reaparece" como no leído por releerlo.
    if (context.requestType === 'briefing_pre_sesion' && finalText) {
      const briefingDate = context.sessionDate ?? new Date().toISOString().slice(0, 10);
      const { error: briefingError } = await adminClient
        .from('omega_briefings')
        .upsert({ user_id: user.id, briefing_date: briefingDate, content: finalText }, { onConflict: 'user_id,briefing_date' });
      if (briefingError) throw briefingError;
    }

    // El Head Coach no tiene tools para registrar sus efectos — el JSON
    // completo ES la respuesta, así que la persistencia (auditoría + misiones
    // reales) pasa acá, server-side, en vez de en runTool.
    if (isHeadCoach) {
      // deno-lint-ignore no-explicit-any
      let parsed: any;
      try {
        const cleaned = finalText.trim().replace(/^```(?:json)?\s*|\s*```$/g, '');
        parsed = JSON.parse(cleaned);
      } catch {
        return new Response(JSON.stringify({ ok: false, error: 'Omega no devolvió un JSON válido.' }), {
          status: 502,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const gameState = ['A', 'B', 'C'].includes(parsed.game_state) ? parsed.game_state : 'B';
      const strengths = Array.isArray(parsed.strengths) ? parsed.strengths : [];
      const weaknesses = Array.isArray(parsed.weaknesses) ? parsed.weaknesses : [];
      const dailyMissions = Array.isArray(parsed.daily_missions) ? parsed.daily_missions : [];
      const manualAudit = parsed.manual_audit ?? { issue_detected: '', suggested_rule: '' };
      const auditDate = new Date().toISOString().slice(0, 10);

      const normalized = {
        game_state: gameState,
        daily_feedback: String(parsed.daily_feedback ?? ''),
        strengths,
        weaknesses,
        daily_missions: dailyMissions,
        manual_audit: manualAudit,
      };

      const { error: upsertError } = await adminClient.from('omega_audits').upsert(
        { user_id: user.id, audit_date: auditDate, ...normalized },
        { onConflict: 'user_id,audit_date' },
      );
      if (upsertError) throw upsertError;

      const { error: deleteError } = await adminClient
        .from('ai_missions')
        .delete()
        .eq('user_id', user.id)
        .eq('audit_date', auditDate);
      if (deleteError) throw deleteError;

      if (dailyMissions.length > 0) {
        const { error: insertError } = await adminClient.from('ai_missions').insert(
          // deno-lint-ignore no-explicit-any
          dailyMissions.map((mission: any) => ({
            user_id: user.id,
            title: String(mission.task ?? 'Misión de Omega'),
            description: String(mission.task ?? ''),
            reward_xp: Number(mission.xpReward) || 0,
            frequency: 'unica',
            audit_date: auditDate,
          })),
        );
        if (insertError) throw insertError;
      }

      finalText = JSON.stringify(normalized);
    }

    // El Recap Semanal es efímero — se parsea/normaliza igual que el Head
    // Coach, pero no se persiste en ninguna tabla (no se pidió historial).
    if (context.requestType === 'recap_semanal') {
      // deno-lint-ignore no-explicit-any
      let parsed: any;
      try {
        const cleaned = finalText.trim().replace(/^```(?:json)?\s*|\s*```$/g, '');
        parsed = JSON.parse(cleaned);
      } catch {
        return new Response(JSON.stringify({ ok: false, error: 'Omega no devolvió un JSON válido.' }), {
          status: 502,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      finalText = JSON.stringify({
        weekly_verdict: String(parsed.weekly_verdict ?? ''),
        top_strength: String(parsed.top_strength ?? ''),
        critical_leak: String(parsed.critical_leak ?? ''),
        action_plan: Array.isArray(parsed.action_plan) ? parsed.action_plan.map((step: unknown) => String(step)) : [],
      });
    }

    // El Cierre de Mes es efímero, igual que el Recap Semanal — mismo
    // mecanismo, distinta forma de JSON (mira ~4 semanas en vez de 1).
    if (context.requestType === 'cierre_mensual') {
      // deno-lint-ignore no-explicit-any
      let parsed: any;
      try {
        const cleaned = finalText.trim().replace(/^```(?:json)?\s*|\s*```$/g, '');
        parsed = JSON.parse(cleaned);
      } catch {
        return new Response(JSON.stringify({ ok: false, error: 'Omega no devolvió un JSON válido.' }), {
          status: 502,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      finalText = JSON.stringify({
        monthly_verdict: String(parsed.monthly_verdict ?? ''),
        execution_summary: String(parsed.execution_summary ?? ''),
        psychological_evolution: String(parsed.psychological_evolution ?? ''),
        top_strength: String(parsed.top_strength ?? ''),
        critical_leak: String(parsed.critical_leak ?? ''),
        next_month_objectives: Array.isArray(parsed.next_month_objectives)
          ? parsed.next_month_objectives.map((step: unknown) => String(step))
          : [],
        action_plan: Array.isArray(parsed.action_plan) ? parsed.action_plan.map((step: unknown) => String(step)) : [],
      });
    }

    return new Response(JSON.stringify({ ok: true, reply: finalText, effects }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No se pudo contactar a Omega.';
    return new Response(JSON.stringify({ ok: false, error: message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function runTool(
  // deno-lint-ignore no-explicit-any
  adminClient: any,
  userId: string,
  name: string,
  // deno-lint-ignore no-explicit-any
  input: any,
  effects: Effects,
  context: OmegaContext,
): Promise<{ ok: boolean; error?: string }> {
  try {
    if (name === 'evaluate_session') {
      // La Ataraxia real (calculada por computeDisciplineScore en el hook) manda
      // siempre que exista — nunca se confía en el número que el modelo proponga
      // por su cuenta, solo se usa como respaldo si no hay una real en contexto.
      const ataraxiaScore = context.ataraxiaPct ?? input.ataraxia_score ?? null;
      const sessionDate = context.sessionDate ?? new Date().toISOString().slice(0, 10);
      const { error } = await adminClient.from('ai_session_verdicts').insert({
        user_id: userId,
        session_date: sessionDate,
        ataraxia_score: ataraxiaScore,
        verdict: input.verdict,
        went_well: input.went_well ?? [],
        went_wrong: input.went_wrong ?? [],
      });
      if (error) throw error;
      effects.sessionVerdict = {
        ataraxia_score: ataraxiaScore,
        verdict: input.verdict,
        went_well: input.went_well ?? [],
        went_wrong: input.went_wrong ?? [],
      };
      return { ok: true };
    }

    if (name === 'update_virtus_and_xp') {
      const points = input.action === 'subtract' ? -Math.abs(input.amount) : Math.abs(input.amount);
      const { error } = await adminClient
        .from('virtus_ai_events')
        .insert({ user_id: userId, points, reason: input.reason });
      if (error) throw error;
      effects.virtusDelta += points;
      return { ok: true };
    }

    if (name === 'validate_positive_streak') {
      const bonus = Math.abs(input.bonus_xp);
      const { error } = await adminClient.from('virtus_ai_events').insert({
        user_id: userId,
        points: bonus,
        reason: `Racha validada: ${input.streak_description}`,
      });
      if (error) throw error;
      effects.virtusDelta += bonus;
      effects.streakValidations.push({ description: input.streak_description, bonus_xp: bonus });
      return { ok: true };
    }

    if (name === 'assign_ai_mission') {
      const { error } = await adminClient.from('ai_missions').insert({
        user_id: userId,
        title: input.title,
        description: input.description,
        reward_xp: input.reward_xp,
        frequency: input.frequency ?? 'unica',
        requires_reflection: Boolean(input.requires_reflection),
      });
      if (error) throw error;
      effects.missionsAssigned.push({ title: input.title, reward_xp: input.reward_xp });
      return { ok: true };
    }

    if (name === 'trigger_ui_alert') {
      effects.uiAlerts.push({ message: input.message, severity: input.severity });
      return { ok: true };
    }

    if (name === 'update_goal_progress') {
      const { data: newPct, error } = await adminClient.rpc('apply_goal_progress_delta', {
        p_user_id: userId,
        p_goal_id: input.goal_id,
        p_delta: input.delta,
      });
      if (error) throw error;
      if (newPct === null || newPct === undefined) {
        return { ok: false, error: 'Meta no encontrada o no es de tipo automática.' };
      }

      const goalText = context.automaticGoals?.find((goal) => goal.id === input.goal_id)?.text ?? input.goal_id;
      const { error: insertError } = await adminClient.from('goal_progress_events').insert({
        user_id: userId,
        goal_id: input.goal_id,
        goal_text: goalText,
        delta: input.delta,
        new_pct: newPct,
        reason: input.reason,
      });
      if (insertError) throw insertError;

      effects.goalUpdates.push({ goalId: input.goal_id, goalText, delta: input.delta, newPct, reason: input.reason });
      return { ok: true };
    }

    if (name === 'update_mission_progress') {
      const { data: newPct, error } = await adminClient.rpc('apply_mission_progress', {
        p_user_id: userId,
        p_mission_id: input.mission_id,
        p_delta: Math.abs(input.delta_pct),
      });
      if (error) throw error;
      if (newPct === null || newPct === undefined) {
        return { ok: false, error: 'Misión no encontrada.' };
      }

      const missionTitle = context.activeMissions?.find((mission) => mission.id === input.mission_id)?.title ?? input.mission_id;
      effects.missionProgressUpdates.push({ missionId: input.mission_id, missionTitle, newPct, reason: input.reason });
      return { ok: true };
    }

    if (name === 'credit_psychological_growth') {
      const { error } = await adminClient.from('psychological_growth_events').insert({
        user_id: userId,
        category: input.category,
        reason: input.reason,
      });
      if (error) throw error;
      effects.psychGrowth.push({ category: input.category, reason: input.reason });
      return { ok: true };
    }

    return { ok: false, error: `Herramienta desconocida: ${name}` };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Error ejecutando la herramienta.' };
  }
}
