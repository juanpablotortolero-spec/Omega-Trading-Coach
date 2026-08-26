import { useCallback, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { readFunctionErrorMessage } from '../lib/functionsError';
import { supabase } from '../lib/supabaseClient';
import {
  getFundingAccountsForJournalEntry,
  getJournalEntryByDate,
  getLatestJournalEntryDate,
  getLatestSessionVerdict,
  getOperations,
  getTradingPlan,
  getVirtusDelta,
  getVirtusTotal,
  type AiSessionVerdict,
  type FundingAccount,
  type JournalEntryFull,
  type OperationItem,
  type TradingPlan,
} from '../lib/api';
import { localIsoDate } from '../lib/calendar';
import { computeDisciplineScore } from '../lib/disciplineScore';
import { getEventsForDate, getWeeklyEconomicEvents, isWithinFetchedWeek, type EconomicEvent } from '../lib/economicCalendar';
import { currentStage } from '../lib/virtus';

export type OmegaMessage = { role: 'user' | 'assistant'; content: string };

export type ActiveAlert = { id: string; message: string; severity: 'info' | 'warning' | 'critical' };

export type OmegaEffects = {
  virtusDelta: number;
  missionsAssigned: { title: string; reward_xp: number }[];
  uiAlerts: { message: string; severity: 'info' | 'warning' | 'critical' }[];
  streakValidations: { description: string; bonus_xp: number }[];
  sessionVerdict: { ataraxia_score: number | null; verdict: string; went_well: string[]; went_wrong: string[] } | null;
  goalUpdates: { goalId: string; goalText: string; delta: number; newPct: number; reason: string }[];
};

type OmegaRequestType = 'chat' | 'briefing_pre_sesion' | 'auditoria_post_sesion' | 'auditoria_head_coach';

type OmegaResponse = { ok: true; reply: string; effects: OmegaEffects } | { ok: false; error: string };

export type HeadCoachAudit = {
  game_state: 'A' | 'B' | 'C';
  daily_feedback: string;
  strengths: { behavior: string; hypothesis: string; fix: string }[];
  weaknesses: { behavior: string; hypothesis: string; fix: string }[];
  daily_missions: { id: number; task: string; xpReward: number }[];
  manual_audit: { issue_detected: string; suggested_rule: string };
};

/** Quita cercas de markdown (```json ... ```) si el modelo las agregó a pesar de la instrucción de responder JSON puro. */
function stripMarkdownFence(text: string): string {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenced ? fenced[1].trim() : trimmed;
}

/**
 * Trae el journal + operaciones + plan de un día y calcula su Ataraxia real
 * con la MISMA función que ya usa el resto de la app (computeDisciplineScore)
 * — nunca se inventa un número aparte para el chat.
 */
async function getSessionData(
  userId: string,
  date: string,
): Promise<{ score: number | null; entry: JournalEntryFull | null; operations: OperationItem[]; plan: TradingPlan | null }> {
  const entry = await getJournalEntryByDate(userId, date);
  if (!entry || !entry.id) return { score: null, entry: null, operations: [], plan: null };

  const [operations, plan] = await Promise.all([getOperations(entry.id), getTradingPlan(userId)]);
  const { score } = computeDisciplineScore({
    directriz: entry.directriz,
    quiz: entry.custom_fields.quiz,
    psychologyEmotions: entry.custom_fields.psychology_emotions,
    operations: operations.map((op) => ({ model: op.model, session: op.session, brokePlan: op.brokePlan })),
    maxTradesPerSession: plan?.max_trades_per_session ?? null,
  });

  return { score, entry, operations, plan };
}

/**
 * Candado de riesgo — cuentas de fondeo reales asociadas al journal auditado,
 * con el % de distancia ya consumida hacia la quema (MISMA fórmula que el
 * indicador rojo de `FundingAccountCard`) para que Omega no tenga que
 * recalcular ni inventar ese número.
 */
async function getFundingRiskContext(journalEntryId: string | null): Promise<
  { accountName: string; currentBalance: number; startingBalance: number; drawdownLimit: number; dailyLossLimit: number | null; dangerPct: number }[]
> {
  if (!journalEntryId) return [];
  const accounts: FundingAccount[] = await getFundingAccountsForJournalEntry(journalEntryId);
  return accounts.map((account) => ({
    accountName: account.accountName,
    currentBalance: account.currentBalance,
    startingBalance: account.startingBalance,
    drawdownLimit: account.drawdownLimit,
    dailyLossLimit: account.dailyLossLimit,
    dangerPct: Math.round(
      Math.min(
        100,
        Math.max(
          0,
          ((account.startingBalance - account.currentBalance) / (account.startingBalance - account.drawdownLimit)) * 100,
        ),
      ),
    ),
  }));
}

/** El cruce journal + Manual Operativo que Omega recibe para evaluar una sesión completa. */
function buildSessionDigest(
  date: string,
  entry: JournalEntryFull,
  operations: OperationItem[],
  plan: TradingPlan | null,
): string {
  const quizLines =
    Object.entries(entry.custom_fields.quiz)
      .filter(([, a]) => a.answer)
      .map(([key, a]) => `- ${key}: ${a.answer}${a.note ? ` (${a.note})` : ''}`)
      .join('\n') || '(sin respuestas)';

  const opsLines = operations.length
    ? operations
        .map(
          (op, i) =>
            `${i + 1}. ${op.symbol || 'símbolo?'} — modelo: ${op.model || 'sin modelo'} · sesión: ${op.session ?? 'sin sesión'} · calidad: ${op.quality ?? '—'} · resultado: ${op.outcome ?? '—'} · P&L: ${op.pnl || '—'} · ¿rompió el plan?: ${op.brokePlan ? 'sí' : 'no'}`,
        )
        .join('\n')
    : '(sin operaciones registradas)';

  return `SESIÓN DEL ${date} — cruce journal + Manual Operativo:

Directriz operativa: ${entry.directriz || '(no escrita)'}
Estado emocional pre-sesión: ${entry.emotional_state ?? '—'}
Emociones marcadas post-mercado: ${entry.custom_fields.psychology_emotions.join(', ') || '—'}
¿Rompió disciplina?: ${entry.discipline_break_reason ? `sí — ${entry.discipline_break_reason}${entry.discipline_break_note ? `: ${entry.discipline_break_note}` : ''}` : 'no reportado'}

Quiz post-mercado:
${quizLines}

Operaciones del día:
${opsLines}

Reglas relevantes del Manual Operativo:
- Gestión de riesgo: ${plan?.risk_management || '(no definida)'}
- Reglas psicológicas: ${plan?.psychological_rules || '(no definidas)'}
- Días sin operar: ${plan?.no_trade_days || '(no definidos)'}
- Trades permitidos por sesión: ${plan?.max_trades_per_session || '(no definido)'}
- Plan ante rachas negativas: ${plan?.losing_streak_plan || '(no definido)'}`;
}

/**
 * Reglas del plan para hoy + tendencia reciente + el último veredicto
 * guardado (de ahí sale "lo que se hizo bien/mal ayer") + las metas del plan
 * (de ahí sale el enfoque mental del día) — lo que Omega usa para un
 * briefing proactivo, sin journal de por medio todavía.
 */
function buildBriefingDigest(
  plan: TradingPlan | null,
  virtusDelta7d: number,
  latestVerdict: AiSessionVerdict | null,
  todayHighImpactEvents: EconomicEvent[] | null,
): string {
  const goalsLines = plan?.goals?.length ? plan.goals.map((g) => `- ${g.text}`).join('\n') : '(sin metas definidas)';

  const verdictBlock = latestVerdict
    ? `Último veredicto guardado (${latestVerdict.session_date}${latestVerdict.ataraxia_score !== null ? `, Ataraxia ${latestVerdict.ataraxia_score}%` : ''}):
- Se hizo bien: ${latestVerdict.went_well.join('; ') || '—'}
- Se hizo mal: ${latestVerdict.went_wrong.join('; ') || '—'}`
    : 'Sin veredicto de sesión anterior guardado todavía.';

  // null = fuera de la semana que cubre el feed (no hay dato real que mostrar,
  // así que no se afirma "sin noticias" — sería fabricar un negativo).
  const newsBlock =
    todayHighImpactEvents === null
      ? '(fuera del rango de fechas que cubre el calendario esta semana)'
      : todayHighImpactEvents.length > 0
        ? todayHighImpactEvents
            .map((event) => `- ${new Date(event.date).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })} ${event.title} (${event.country})`)
            .join('\n')
        : '(ninguna reconocida para hoy)';

  return `BRIEFING PRE-SESIÓN — reglas del Manual Operativo para hoy:

Horario operativo: ${plan?.schedule_start || '—'} a ${plan?.schedule_end || '—'}
Trades permitidos por sesión: ${plan?.max_trades_per_session || '(no definido)'}
Días sin operar: ${plan?.no_trade_days || '(no definidos)'}
Gestión de riesgo: ${plan?.risk_management || '(no definida)'}
Reglas psicológicas: ${plan?.psychological_rules || '(no definidas)'}
Plan ante eventos macro: ${plan?.macro_event_plan || '(no definido)'}

Noticias de alto impacto hoy (real, del calendario económico):
${newsBlock}

Metas del trader (para enfocar el día):
${goalsLines}

${verdictBlock}

Tendencia de Virtus en los últimos 7 días: ${virtusDelta7d >= 0 ? '+' : ''}${virtusDelta7d} pts`;
}

/**
 * Puente al Edge Function omega-coach. La función ya ejecuta las tool calls
 * server-side (Service Role) y devuelve el resultado aplicado — este hook
 * solo manda el mensaje y refleja la respuesta/efectos en estado local, no
 * vuelve a escribir nada en Supabase por su cuenta.
 *
 * No incluye ninguna UI (ventana de chat, pop-up de alertas) — eso queda para
 * cuando se construya esa pantalla; por ahora expone `lastEffects` para que
 * un componente futuro decida cómo mostrarlos.
 */
export function useOmegaAgent() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<OmegaMessage[]>([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastEffects, setLastEffects] = useState<OmegaEffects | null>(null);
  const [uiAlerts, setUiAlerts] = useState<ActiveAlert[]>([]);

  const dismissAlert = useCallback((id: string) => {
    setUiAlerts((current) => current.filter((alert) => alert.id !== id));
  }, []);

  const invokeOmega = useCallback(
    async (
      nextMessages: OmegaMessage[],
      contextExtra: {
        ataraxiaPct: number | null;
        sessionDigest?: string;
        requestType?: OmegaRequestType;
        sessionDate?: string;
        fundingAccounts?: Awaited<ReturnType<typeof getFundingRiskContext>>;
      },
    ) => {
      if (!user) return;
      setMessages(nextMessages);
      setSending(true);
      setError(null);

      try {
        const [virtusTotal, plan] = await Promise.all([getVirtusTotal(user.id), getTradingPlan(user.id)]);
        const stage = currentStage(virtusTotal);
        const automaticGoals = (plan?.goals ?? [])
          .filter((goal) => goal.type === 'automatic')
          .map((goal) => ({ id: goal.id, text: goal.text, progressPct: goal.progressPct }));

        const { data, error: invokeError } = await supabase.functions.invoke('omega-coach', {
          body: {
            messages: nextMessages,
            context: { virtusStage: stage.level, virtusTotal, automaticGoals, ...contextExtra },
          },
        });

        if (invokeError) {
          throw new Error(await readFunctionErrorMessage(invokeError, 'No se pudo contactar a Omega.'));
        }

        const result = data as OmegaResponse;
        if (!result.ok) throw new Error(result.error);

        setMessages((current) => [...current, { role: 'assistant', content: result.reply }]);
        setLastEffects(result.effects);
        if (result.effects.uiAlerts.length > 0) {
          setUiAlerts((current) => [
            ...current,
            ...result.effects.uiAlerts.map((alert) => ({ id: crypto.randomUUID(), ...alert })),
          ]);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'No se pudo contactar a Omega.');
      } finally {
        setSending(false);
      }
    },
    [user],
  );

  const sendMessage = useCallback(
    async (text: string) => {
      if (!user || !text.trim() || sending) return;
      const today = localIsoDate(new Date());
      const { score } = await getSessionData(user.id, today);
      await invokeOmega([...messages, { role: 'user', content: text.trim() }], {
        ataraxiaPct: score,
        requestType: 'chat',
      });
    },
    [user, messages, sending, invokeOmega],
  );

  /**
   * Evalúa una sesión completa: trae el journal de esa fecha (hoy por
   * defecto), lo cruza con el Manual Operativo, calcula su Ataraxia real, y
   * le pide a Omega un veredicto — en vez de esperar a que el trader le
   * describa el día a mano.
   */
  const evaluateSession = useCallback(
    async (date?: string) => {
      if (!user || sending) return;
      const targetDate = date ?? localIsoDate(new Date());
      setSending(true);
      setError(null);

      try {
        const { score, entry, operations, plan } = await getSessionData(user.id, targetDate);
        if (!entry) {
          setError(`No hay journal registrado el ${targetDate}.`);
          return;
        }
        const digest = buildSessionDigest(targetDate, entry, operations, plan);
        const fundingAccounts = await getFundingRiskContext(entry.id);
        await invokeOmega([...messages, { role: 'user', content: `Evalúa mi sesión del ${targetDate}.` }], {
          ataraxiaPct: score,
          sessionDigest: digest,
          requestType: 'auditoria_post_sesion',
          sessionDate: targetDate,
          fundingAccounts,
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'No se pudo evaluar la sesión.');
      } finally {
        // invokeOmega ya se encarga de apagar `sending` en su propio finally
        // cuando corre — esto solo cubre el camino en que nunca se llegó a
        // invocarlo (ej. no había journal ese día).
        setSending(false);
      }
    },
    [user, messages, sending, invokeOmega],
  );

  /**
   * Briefing pre-sesión proactivo: no depende de un journal (el trader
   * todavía no ha operado hoy) — arma contexto a partir del Manual Operativo
   * y la tendencia reciente de Virtus, y le pide a Omega que hable primero.
   */
  const requestBriefing = useCallback(async () => {
    if (!user || sending) return;
    setSending(true);
    setError(null);

    try {
      const [plan, virtusDelta7d, latestVerdict] = await Promise.all([
        getTradingPlan(user.id),
        getVirtusDelta(user.id, 7),
        getLatestSessionVerdict(user.id),
      ]);

      const today = localIsoDate(new Date());
      let todayHighImpactEvents: EconomicEvent[] | null = null;
      if (isWithinFetchedWeek(today)) {
        try {
          const weekEvents = await getWeeklyEconomicEvents();
          todayHighImpactEvents = getEventsForDate(weekEvents, today).filter((event) => event.impact === 'High');
        } catch {
          // El calendario económico es un extra del briefing, no su núcleo —
          // si falla, el briefing sigue sin esa parte en vez de romperse entero.
          todayHighImpactEvents = null;
        }
      }

      const digest = buildBriefingDigest(plan, virtusDelta7d, latestVerdict, todayHighImpactEvents);
      await invokeOmega([...messages, { role: 'user', content: 'Dame mi briefing pre-sesión de hoy.' }], {
        ataraxiaPct: null,
        sessionDigest: digest,
        requestType: 'briefing_pre_sesion',
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo generar el briefing.');
    } finally {
      setSending(false);
    }
  }, [user, messages, sending, invokeOmega]);

  /**
   * Auditoría "Head Coach" para OmegaDashboard — deliberadamente aislada del
   * estado del chat flotante (no toca `messages`/`lastEffects`/`sending`):
   * esta llamada exige que la ÚNICA respuesta sea un JSON puro
   * (requestType 'auditoria_head_coach', sin tools disponibles del lado del
   * servidor), así que mezclarla con la transcripción del chat mostraría un
   * bloque de JSON crudo como si fuera una burbuja de conversación normal.
   */
  const requestHeadCoachAudit = useCallback(
    async (): Promise<HeadCoachAudit> => {
      if (!user) throw new Error('No autenticado.');

      const latestDate = await getLatestJournalEntryDate(user.id);
      if (!latestDate) throw new Error('No hay journals registrados todavía.');

      const { score, entry, operations, plan } = await getSessionData(user.id, latestDate);
      if (!entry) throw new Error('No hay journals registrados todavía.');

      const sessionText = buildSessionDigest(latestDate, entry, operations, plan);
      const [virtusTotal, fundingAccounts] = await Promise.all([
        getVirtusTotal(user.id),
        getFundingRiskContext(entry.id),
      ]);
      const stage = currentStage(virtusTotal);

      const { data, error: invokeError } = await supabase.functions.invoke('omega-coach', {
        body: {
          messages: [{ role: 'user', content: sessionText }],
          context: {
            virtusStage: stage.level,
            virtusTotal,
            ataraxiaPct: score,
            requestType: 'auditoria_head_coach',
            fundingAccounts,
          },
        },
      });

      if (invokeError) {
        throw new Error(await readFunctionErrorMessage(invokeError, 'No se pudo contactar a Omega.'));
      }

      const result = data as OmegaResponse;
      if (!result.ok) throw new Error(result.error);

      try {
        return JSON.parse(stripMarkdownFence(result.reply)) as HeadCoachAudit;
      } catch {
        throw new Error('Omega no devolvió un JSON válido.');
      }
    },
    [user],
  );

  return {
    messages,
    sending,
    error,
    lastEffects,
    uiAlerts,
    dismissAlert,
    sendMessage,
    evaluateSession,
    requestBriefing,
    requestHeadCoachAudit,
  };
}
