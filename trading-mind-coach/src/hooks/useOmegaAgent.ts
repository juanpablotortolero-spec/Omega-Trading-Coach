import { useCallback, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { readFunctionErrorMessage } from '../lib/functionsError';
import { supabase } from '../lib/supabaseClient';
import {
  getAiMissions,
  getDisciplineInputsByDate,
  getFundingAccounts,
  getFundingAccountsForJournalEntry,
  getJournalEntryByDate,
  getLatestJournalEntryDate,
  getLatestSessionVerdict,
  getOmegaAuditsForWeek,
  getOperations,
  getOperationsInRange,
  getRecentMissionReflections,
  getTradingPlan,
  getVirtusAiEventsForWeek,
  getVirtusDelta,
  getVirtusTotal,
  getWeekBounds,
  getWeeklyKillSwitchStatus,
  type AiSessionVerdict,
  type FundingAccount,
  type JournalEntryFull,
  type OperationItem,
  type OperationRecord,
  type TradingPlan,
} from '../lib/api';
import { localIsoDate } from '../lib/calendar';
import { computeDisciplineScore, computeDisciplineTimeline, type DisciplineOperationInput } from '../lib/disciplineScore';
import { getEventsForDate, getWeeklyEconomicEvents, isWithinFetchedWeek, type EconomicEvent } from '../lib/economicCalendar';
import { computeDangerPct } from '../lib/risk';
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
  missionProgressUpdates: { missionId: string; missionTitle: string; newPct: number; reason: string }[];
  psychGrowth: { category: 'correccion' | 'fortaleza'; reason: string }[];
};

type OmegaRequestType =
  | 'chat'
  | 'briefing_pre_sesion'
  | 'auditoria_post_sesion'
  | 'auditoria_head_coach'
  | 'recap_semanal'
  | 'cierre_mensual';

type OmegaResponse = { ok: true; reply: string; effects: OmegaEffects } | { ok: false; error: string };

export type HeadCoachAudit = {
  game_state: 'A' | 'B' | 'C';
  daily_feedback: string;
  strengths: { behavior: string; hypothesis: string; fix: string }[];
  weaknesses: { behavior: string; hypothesis: string; fix: string }[];
  daily_missions: { id: number; task: string; xpReward: number }[];
  manual_audit: { issue_detected: string; suggested_rule: string };
};

export type WeeklyRecap = {
  weekly_verdict: string;
  top_strength: string;
  critical_leak: string;
  action_plan: string[];
};

export type WeeklyRecapResult = {
  recap: WeeklyRecap;
  metrics: {
    greenDays: number;
    redDays: number;
    missionsCompleted: number;
    xpFromMissions: number;
    weekStart: string;
    weekEnd: string;
  };
};

export type MonthlyClose = {
  monthly_verdict: string;
  execution_summary: string;
  psychological_evolution: string;
  top_strength: string;
  critical_leak: string;
  next_month_objectives: string[];
  action_plan: string[];
};

export type MonthlyCloseResult = {
  close: MonthlyClose;
  metrics: {
    monthLabel: string;
    tradesCount: number;
    winCount: number;
    lossCount: number;
    pnlTotal: number;
    brokePlanCount: number;
    ataraxiaAvg: number | null;
    missionsCompleted: number;
    xpFromMissions: number;
    monthStart: string;
    monthEnd: string;
  };
};

/** Hasta 4 URLs de capturas reales de las operaciones del día — para que Omega vea la sesión, no solo la lea. */
function collectScreenshotUrls(operations: OperationItem[]): string[] {
  const urls: string[] = [];
  for (const op of operations) {
    for (const shot of op.screenshots) {
      if (urls.length >= 4) return urls;
      urls.push(shot.url);
    }
  }
  return urls;
}

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
type FundingRiskContext = {
  accountName: string;
  currentBalance: number;
  startingBalance: number;
  drawdownLimit: number;
  dailyLossLimit: number | null;
  dangerPct: number;
}[];

function toFundingRiskContext(accounts: FundingAccount[]): FundingRiskContext {
  return accounts.map((account) => ({
    accountName: account.accountName,
    currentBalance: account.currentBalance,
    startingBalance: account.startingBalance,
    drawdownLimit: account.drawdownLimit,
    dailyLossLimit: account.dailyLossLimit,
    dangerPct: computeDangerPct(account.startingBalance, account.currentBalance, account.drawdownLimit),
  }));
}

async function getFundingRiskContext(journalEntryId: string | null): Promise<FundingRiskContext> {
  if (!journalEntryId) return [];
  return toFundingRiskContext(await getFundingAccountsForJournalEntry(journalEntryId));
}

/**
 * TODAS las cuentas activas del trader (no solo las de un journal puntual) —
 * usada en el briefing pre-sesión, para que el candado de riesgo pueda
 * advertir ANTES de que empiece la sesión, no solo en la auditoría posterior.
 */
async function getAllFundingRiskContext(userId: string): Promise<FundingRiskContext> {
  const accounts = await getFundingAccounts(userId);
  return toFundingRiskContext(accounts.filter((account) => account.status === 'active'));
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
- Plan ante rachas negativas: ${plan?.losing_streak_plan || '(no definido)'}
- Reglas de análisis técnico: ${plan?.market_analysis_rules || '(no definidas)'}
- Reglas de preservación de capital: ${plan?.capital_preservation_rules || '(no definidas)'}
- Setups definidos: ${plan?.setups?.length ? plan.setups.map((s) => s.name).filter(Boolean).join(', ') || '(sin nombres)' : '(sin setups definidos)'}`;
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
        previousVerdict?: { wentWell: string[]; wentWrong: string[] };
        screenshotUrls?: string[];
      },
    ) => {
      if (!user) return;
      setMessages(nextMessages);
      setSending(true);
      setError(null);

      try {
        const [virtusTotal, plan, aiMissions, missionReflections] = await Promise.all([
          getVirtusTotal(user.id),
          getTradingPlan(user.id),
          getAiMissions(user.id),
          getRecentMissionReflections(user.id),
        ]);
        const stage = currentStage(virtusTotal);
        const automaticGoals = (plan?.goals ?? [])
          .filter((goal) => goal.type === 'automatic')
          .map((goal) => ({ id: goal.id, text: goal.text, progressPct: goal.progressPct }));
        const activeMissions = aiMissions
          .filter((mission) => !mission.completed && !mission.expired_at)
          .map((mission) => ({ id: mission.id, title: mission.title, description: mission.description, progressPct: mission.progress_pct }));

        const { data, error: invokeError } = await supabase.functions.invoke('omega-coach', {
          body: {
            messages: nextMessages,
            context: { virtusStage: stage.level, virtusTotal, automaticGoals, activeMissions, missionReflections, ...contextExtra },
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
        // Se pide ANTES de invocar a Omega: evaluate_session recién va a
        // crear el veredicto de HOY dentro de esta misma llamada, así que
        // en este punto getLatestSessionVerdict todavía devuelve el de la
        // sesión anterior — exactamente lo que credit_psychological_growth
        // necesita para comparar.
        const [fundingAccounts, latestVerdict] = await Promise.all([
          getFundingRiskContext(entry.id),
          getLatestSessionVerdict(user.id),
        ]);
        await invokeOmega([...messages, { role: 'user', content: `Evalúa mi sesión del ${targetDate}.` }], {
          ataraxiaPct: score,
          sessionDigest: digest,
          requestType: 'auditoria_post_sesion',
          sessionDate: targetDate,
          fundingAccounts,
          previousVerdict: latestVerdict ? { wentWell: latestVerdict.went_well, wentWrong: latestVerdict.went_wrong } : undefined,
          screenshotUrls: collectScreenshotUrls(operations),
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
      const [plan, virtusDelta7d, latestVerdict, fundingAccounts] = await Promise.all([
        getTradingPlan(user.id),
        getVirtusDelta(user.id, 7),
        getLatestSessionVerdict(user.id),
        getAllFundingRiskContext(user.id),
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
        sessionDate: today,
        fundingAccounts,
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
      const automaticGoals = (plan?.goals ?? [])
        .filter((goal) => goal.type === 'automatic')
        .map((goal) => ({ id: goal.id, text: goal.text, progressPct: goal.progressPct }));

      const { data, error: invokeError } = await supabase.functions.invoke('omega-coach', {
        body: {
          messages: [{ role: 'user', content: sessionText }],
          context: {
            virtusStage: stage.level,
            virtusTotal,
            ataraxiaPct: score,
            requestType: 'auditoria_head_coach',
            fundingAccounts,
            automaticGoals,
            screenshotUrls: collectScreenshotUrls(operations),
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

  /**
   * Recap Semanal para OmegaDashboard — mismo aislamiento que
   * requestHeadCoachAudit (no toca el chat flotante). No se persiste en
   * ninguna tabla: no se pidió historial de recaps pasados, solo generarlo y
   * mostrarlo en el modal al hacer clic.
   */
  /**
   * `referenceDate` fija QUÉ semana se audita (por defecto, la actual) — el
   * calendario histórico de briefings ahora ofrece un botón de Auditoría
   * Semanal por cada fila/semana ya cerrada, no solo la de hoy.
   */
  const requestWeeklyRecap = useCallback(async (referenceDate: Date = new Date()): Promise<WeeklyRecapResult> => {
    if (!user) throw new Error('No autenticado.');

    const { weekStart, weekEnd } = getWeekBounds(referenceDate);
    const [killSwitch, audits, virtusEvents, virtusTotal] = await Promise.all([
      getWeeklyKillSwitchStatus(user.id, referenceDate),
      getOmegaAuditsForWeek(user.id, weekStart, weekEnd),
      getVirtusAiEventsForWeek(user.id, weekStart, weekEnd),
      getVirtusTotal(user.id),
    ]);

    const gameStateCounts = { A: 0, B: 0, C: 0 };
    audits.forEach((audit) => {
      gameStateCounts[audit.gameState] += 1;
    });

    const missionEvents = virtusEvents.filter((event) => event.reason.startsWith('Misión completada:'));
    const missionsCompleted = missionEvents.length;
    const xpFromMissions = missionEvents.reduce((sum, event) => sum + event.points, 0);

    const strengthsLines = audits.flatMap((a) => a.strengths.map((s) => `- ${s.behavior}`));
    const weaknessesLines = audits.flatMap((a) => a.weaknesses.map((w) => `- ${w.behavior}`));

    const digest = `RECAP SEMANAL — semana del ${weekStart} al ${weekEnd}:

Resultado neto: ${killSwitch.greenDays} días ganadores, ${killSwitch.redDays} días en pérdida (de lunes a viernes).

Estados mentales registrados (Juego A/B/C, de las auditorías de esta semana):
- Juego A: ${gameStateCounts.A} día(s)
- Juego B: ${gameStateCounts.B} día(s)
- Juego C: ${gameStateCounts.C} día(s)
${audits.length === 0 ? '(No hay auditorías de "Auditar Última Sesión" registradas esta semana.)' : ''}

Misiones de Omega completadas esta semana: ${missionsCompleted}
XP ganada por esas misiones: ${xpFromMissions} pts
Virtus total de la cuenta: ${virtusTotal} pts

Fortalezas identificadas esta semana:
${strengthsLines.length > 0 ? strengthsLines.join('\n') : '(ninguna registrada)'}

Fugas de capital/energía identificadas esta semana (buscá la que más se repite):
${weaknessesLines.length > 0 ? weaknessesLines.join('\n') : '(ninguna registrada)'}`;

    const stage = currentStage(virtusTotal);
    const { data, error: invokeError } = await supabase.functions.invoke('omega-coach', {
      body: {
        messages: [{ role: 'user', content: digest }],
        context: { virtusStage: stage.level, virtusTotal, ataraxiaPct: null, requestType: 'recap_semanal' },
      },
    });

    if (invokeError) {
      throw new Error(await readFunctionErrorMessage(invokeError, 'No se pudo contactar a Omega.'));
    }

    const result = data as OmegaResponse;
    if (!result.ok) throw new Error(result.error);

    try {
      const recap = JSON.parse(stripMarkdownFence(result.reply)) as WeeklyRecap;
      return {
        recap,
        metrics: {
          greenDays: killSwitch.greenDays,
          redDays: killSwitch.redDays,
          missionsCompleted,
          xpFromMissions,
          weekStart,
          weekEnd,
        },
      };
    } catch {
      throw new Error('Omega no devolvió un JSON válido.');
    }
  }, [user]);

  /**
   * Auditoría Mensual para OmegaDashboard — mismo aislamiento que
   * requestWeeklyRecap, pero sobre un MES CALENDARIO completo y ya cerrado
   * (no una ventana rodante de "últimas 4 semanas"): `monthStart`/`monthEnd`
   * vienen del calendario histórico, que solo revela el botón una vez que
   * ese mes terminó. El digest es deliberadamente el más rico de todos los
   * que arma este hook — trades reales, setups, P&L, ejecución, evolución
   * día a día de Ataraxia, misiones y metas — para que Omega pueda producir
   * "el mejor resumen posible" en vez de un veredicto genérico de 3 líneas.
   */
  const requestMonthlyClose = useCallback(
    async (monthStart: string, monthEnd: string): Promise<MonthlyCloseResult> => {
      if (!user) throw new Error('No autenticado.');

      const [ops, audits, virtusEvents, virtusTotal, plan, disciplineInputs] = await Promise.all([
        getOperationsInRange(user.id, monthStart, monthEnd),
        getOmegaAuditsForWeek(user.id, monthStart, monthEnd),
        getVirtusAiEventsForWeek(user.id, monthStart, monthEnd),
        getVirtusTotal(user.id),
        getTradingPlan(user.id),
        getDisciplineInputsByDate(user.id),
      ]);

      // Ataraxia diaria del mes — MISMO cálculo que Dashboard/Estadísticas
      // (computeDisciplineTimeline), solo filtrado a las fechas de este mes.
      const opsByDate = new Map<string, DisciplineOperationInput[]>();
      ops.forEach((op: OperationRecord) => {
        const list = opsByDate.get(op.entry_date) ?? [];
        list.push({ model: op.model, session: op.session, brokePlan: op.broke_plan });
        opsByDate.set(op.entry_date, list);
      });
      const monthEntries = Object.fromEntries(
        Object.entries(disciplineInputs).filter(([date]) => date >= monthStart && date <= monthEnd),
      );
      const timeline = computeDisciplineTimeline(monthEntries, opsByDate, plan?.max_trades_per_session ?? null);
      const ataraxiaAvg =
        timeline.length > 0 ? Math.round(timeline.reduce((sum, day) => sum + day.score, 0) / timeline.length) : null;
      const ataraxiaLines = timeline.map((day) => `- ${day.date}: ${day.score}%`).join('\n');

      const tradesCount = ops.length;
      const winCount = ops.filter((op) => op.outcome === 'TP').length;
      const lossCount = ops.filter((op) => op.outcome === 'SL').length;
      const beCount = ops.filter((op) => op.outcome === 'BE').length;
      const pnlTotal = ops.reduce((sum, op) => sum + (op.pnl ?? 0), 0);
      const brokePlanCount = ops.filter((op) => op.broke_plan).length;

      const modelStats = new Map<string, { count: number; wins: number; pnl: number }>();
      ops.forEach((op) => {
        const key = op.model || 'Sin modelo especificado';
        const stat = modelStats.get(key) ?? { count: 0, wins: 0, pnl: 0 };
        stat.count += 1;
        if (op.outcome === 'TP') stat.wins += 1;
        stat.pnl += op.pnl ?? 0;
        modelStats.set(key, stat);
      });
      const modelLines = [...modelStats.entries()]
        .map(
          ([model, stat]) =>
            `- ${model}: ${stat.count} trade(s), ${stat.wins}/${stat.count} ganadores, P&L ${stat.pnl >= 0 ? '+' : ''}$${stat.pnl.toFixed(2)}`,
        )
        .join('\n');

      const gameStateCounts = { A: 0, B: 0, C: 0 };
      audits.forEach((audit) => {
        gameStateCounts[audit.gameState] += 1;
      });

      const missionEvents = virtusEvents.filter((event) => event.reason.startsWith('Misión completada:'));
      const missionsCompleted = missionEvents.length;
      const xpFromMissions = missionEvents.reduce((sum, event) => sum + event.points, 0);

      const strengthsLines = audits.flatMap((a) => a.strengths.map((s) => `- ${s.behavior}`));
      const weaknessesLines = audits.flatMap((a) => a.weaknesses.map((w) => `- ${w.behavior}`));

      const automaticGoals = (plan?.goals ?? []).filter((goal) => goal.type === 'automatic');
      const goalsLines =
        automaticGoals.length > 0
          ? automaticGoals.map((goal) => `- "${goal.text}": ${goal.progressPct}%`).join('\n')
          : '(sin metas automáticas definidas)';

      const monthLabel = new Date(`${monthStart}T12:00:00`).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });

      const digest = `AUDITORÍA MENSUAL — mes calendario completo de ${monthLabel} (${monthStart} al ${monthEnd}):

Operaciones registradas: ${tradesCount} — ${winCount} ganadoras (TP), ${lossCount} perdedoras (SL), ${beCount} en breakeven.
P&L neto del mes: ${pnlTotal >= 0 ? '+' : ''}$${pnlTotal.toFixed(2)}
Rupturas de plan (broke_plan): ${brokePlanCount} de ${tradesCount} operaciones.

Setups/modelos usados este mes:
${tradesCount > 0 ? modelLines : '(sin operaciones registradas este mes)'}

Evolución diaria de Ataraxia (score de disciplina, 0-100%) este mes:
${timeline.length > 0 ? ataraxiaLines : '(sin journals sellados este mes)'}
Promedio del mes: ${ataraxiaAvg !== null ? `${ataraxiaAvg}%` : 'sin datos suficientes'}

Estados mentales registrados (Juego A/B/C, de las auditorías "Auditar Última Sesión" del mes):
- Juego A: ${gameStateCounts.A} día(s)
- Juego B: ${gameStateCounts.B} día(s)
- Juego C: ${gameStateCounts.C} día(s)
${audits.length === 0 ? '(No hay auditorías de "Auditar Última Sesión" registradas este mes.)' : ''}

Misiones de Omega completadas este mes: ${missionsCompleted}
XP ganada por esas misiones: ${xpFromMissions} pts
Virtus total actual de la cuenta: ${virtusTotal} pts

Metas automáticas actuales del Manual Operativo:
${goalsLines}

Fortalezas identificadas este mes:
${strengthsLines.length > 0 ? strengthsLines.join('\n') : '(ninguna registrada)'}

Fugas de capital/energía identificadas este mes:
${weaknessesLines.length > 0 ? weaknessesLines.join('\n') : '(ninguna registrada)'}`;

      const stage = currentStage(virtusTotal);
      const { data, error: invokeError } = await supabase.functions.invoke('omega-coach', {
        body: {
          messages: [{ role: 'user', content: digest }],
          context: { virtusStage: stage.level, virtusTotal, ataraxiaPct: null, requestType: 'cierre_mensual' },
        },
      });

      if (invokeError) {
        throw new Error(await readFunctionErrorMessage(invokeError, 'No se pudo contactar a Omega.'));
      }

      const result = data as OmegaResponse;
      if (!result.ok) throw new Error(result.error);

      try {
        const close = JSON.parse(stripMarkdownFence(result.reply)) as MonthlyClose;
        return {
          close,
          metrics: {
            monthLabel,
            tradesCount,
            winCount,
            lossCount,
            pnlTotal,
            brokePlanCount,
            ataraxiaAvg,
            missionsCompleted,
            xpFromMissions,
            monthStart,
            monthEnd,
          },
        };
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
    requestWeeklyRecap,
    requestMonthlyClose,
  };
}
