import { computeDisciplineTimeline, gameStateFromScore, type DisciplineOperationInput } from './disciplineScore';
import type { DailyDisciplineScore, DisciplineScoreResult } from './disciplineScore';
import type { EconomicEvent } from './economicCalendar';
import { getAllOperations, getDisciplineInputsByDate, getTradingPlan } from './api';
import type { PreSessionResponse, TradingPlan } from './api';
import { CHECK_COPY } from './missionCatalog';

export { CHECK_COPY };

// Reemplazo 100% determinista del antiguo "Head Coach" de Omega (antes
// generado por Anthropic vía la Edge Function omega-coach, ya eliminada) —
// cada pieza de texto sale de una tabla fija anclada a una de las 10 reglas
// de computeDisciplineScore, nunca de un modelo de lenguaje. El catálogo
// CHECK_COPY vive en missionCatalog.ts (no acá) para que api.ts pueda
// importarlo sin crear un ciclo de módulos con este archivo.

export const STRENGTH_SUSTAIN_FIX = 'Sostené esto — repetilo mañana exactamente igual.';

export const GAME_STATE_FEEDBACK: Record<'A' | 'B' | 'C', string> = {
  A: 'Ejecutaste como se supone que tenés que ejecutar. Disciplina mecánica, plan respetado. Repetilo — no lo festejes de más.',
  B: 'Sesión mixta: hubo tramos de plan real y tramos de impulso. Revisá exactamente qué reglas se rompieron abajo y cerralas mañana.',
  C: 'Zona de Miedo/Indisciplina. La ejecución de hoy no representó tu plan. Pará, revisá cada regla rota abajo antes de la próxima sesión.',
};

export const FEAR_ZONE_INTERVENTION_MESSAGE =
  'Tu Ataraxia cayó a zona de Miedo/Indisciplina. Revisá qué reglas de tu plan no se cumplieron hoy en la pestaña Estado antes de tu próxima sesión.';

export type HeadCoachAuditLike = {
  game_state: 'A' | 'B' | 'C';
  daily_feedback: string;
  strengths: { behavior: string; hypothesis: string; fix: string }[];
  weaknesses: { behavior: string; hypothesis: string; fix: string }[];
  daily_missions: { id: number; task: string; xpReward: number }[];
  manual_audit: { issue_detected: string; suggested_rule: string };
};

/** Reemplaza al Head Coach de IA — arma el mismo objeto, 100% desde reglas fijas. */
export function buildDeterministicAudit(result: DisciplineScoreResult): HeadCoachAuditLike {
  const gameState = result.score === null ? 'B' : gameStateFromScore(result.score);

  const weaknesses = result.negativeIds.map((id, index) => ({
    behavior: result.negatives[index],
    hypothesis: CHECK_COPY[id].weaknessHypothesis,
    fix: CHECK_COPY[id].weaknessFix,
  }));
  const strengths = result.positiveIds.map((id, index) => ({
    behavior: result.positives[index],
    hypothesis: '',
    fix: STRENGTH_SUSTAIN_FIX,
  }));

  const daily_missions = weaknesses.slice(0, 2).map((_weakness, index) => {
    const id = result.negativeIds[index];
    return { id: index + 1, task: CHECK_COPY[id].missionTask, xpReward: CHECK_COPY[id].missionXp };
  });

  const manual_audit =
    weaknesses.length > 0
      ? { issue_detected: weaknesses[0].behavior, suggested_rule: weaknesses[0].fix }
      : { issue_detected: '', suggested_rule: 'Sin incumplimientos detectados hoy — sostené el mismo proceso.' };

  return {
    game_state: gameState,
    daily_feedback: GAME_STATE_FEEDBACK[gameState],
    strengths,
    weaknesses,
    daily_missions,
    manual_audit,
  };
}

/**
 * Día anterior más reciente con datos suficientes para calcular Ataraxia —
 * reemplaza al "último veredicto guardado" que antes escribía la IA
 * (ai_session_verdicts, ya eliminada): mismo rol de arrastre para el
 * Briefing, derivado 100% de computeDisciplineTimeline sobre datos reales.
 */
export async function getLatestPriorDisciplineDay(userId: string, beforeDate: string): Promise<DailyDisciplineScore | null> {
  const [disciplineInputs, allOps, plan] = await Promise.all([
    getDisciplineInputsByDate(userId),
    getAllOperations(userId),
    getTradingPlan(userId),
  ]);

  const priorOpsByDate = new Map<string, DisciplineOperationInput[]>();
  allOps.forEach((op) => {
    if (op.entry_date >= beforeDate) return;
    const list = priorOpsByDate.get(op.entry_date) ?? [];
    list.push({ model: op.model, session: op.session, brokePlan: op.broke_plan });
    priorOpsByDate.set(op.entry_date, list);
  });
  const priorEntries = Object.fromEntries(Object.entries(disciplineInputs).filter(([date]) => date < beforeDate));

  const timeline = computeDisciplineTimeline(priorEntries, priorOpsByDate, plan?.max_trades_per_session ?? null);
  if (timeline.length === 0) return null;
  return [...timeline].sort((a, b) => a.date.localeCompare(b.date)).pop() ?? null;
}

/**
 * Reemplaza al Briefing Pre-Sesión de IA — 3 líneas fijas: diagnóstico
 * (check-in de hoy), correlación (arrastre del día anterior) y regla de oro
 * (el fix de la regla que más se rompió ayer, o una regla genérica si ayer
 * no hubo incumplimientos).
 */
export function buildDeterministicBriefing(input: {
  checkIn: PreSessionResponse | null;
  yesterday: DailyDisciplineScore | null;
  todayHighImpactEvents: EconomicEvent[] | null;
  plan: TradingPlan | null;
}): string {
  const diagnosis = input.checkIn
    ? `DIAGNÓSTICO: llegás "${input.checkIn.feeling}", con mentalidad "${input.checkIn.mindset}".`
    : 'DIAGNÓSTICO: todavía no registraste tu check-in de hoy.';

  const correlation = input.yesterday
    ? input.yesterday.negatives.length > 0
      ? `CORRELACIÓN: ayer (${input.yesterday.date}) fallaste en "${input.yesterday.negatives[0]}" — el patrón sigue abierto hasta que lo corrijas.`
      : `CORRELACIÓN: ayer (${input.yesterday.date}) sostuviste tu disciplina — no la sueltes hoy por exceso de confianza.`
    : 'CORRELACIÓN: todavía no hay una sesión anterior registrada para comparar.';

  const macroClause =
    input.todayHighImpactEvents && input.todayHighImpactEvents.length > 0 && input.plan?.macro_event_plan?.trim()
      ? ` Hoy hay ${input.todayHighImpactEvents[0].title} — tu plan dice: "${input.plan.macro_event_plan.trim()}".`
      : '';

  const goldenRuleBase =
    input.yesterday && input.yesterday.negativeIds.length > 0
      ? CHECK_COPY[input.yesterday.negativeIds[0]].weaknessFix
      : 'Ejecutá exactamente el setup y el riesgo que ya definiste en tu Manual Operativo. Nada más.';

  return [diagnosis, correlation, `REGLA DE ORO: ${goldenRuleBase}${macroClause}`].join('\n');
}

const WEEKLY_VERDICT_BY_BALANCE = (greenDays: number, redDays: number): string =>
  greenDays > redDays
    ? `Semana neta positiva: ${greenDays} día(s) ganador(es) contra ${redDays} en pérdida. Sostené el proceso que te llevó ahí.`
    : redDays > greenDays
      ? `Semana neta negativa: ${redDays} día(s) en pérdida contra ${greenDays} ganador(es). Revisá las reglas rotas más abajo antes de la próxima semana.`
      : `Semana pareja: ${greenDays} día(s) ganador(es) y ${redDays} en pérdida. Ejecución sin tendencia clara — la disciplina, no el resultado, es lo que hay que mirar.`;

export function buildWeeklyVerdict(greenDays: number, redDays: number): string {
  return WEEKLY_VERDICT_BY_BALANCE(greenDays, redDays);
}

export function buildMonthlyVerdict(
  tradesCount: number,
  winCount: number,
  lossCount: number,
  pnlTotal: number,
  ataraxiaAvg: number | null,
): string {
  const pnlClause = pnlTotal >= 0 ? `P&L neto positivo de $${pnlTotal.toFixed(2)}` : `P&L neto negativo de $${pnlTotal.toFixed(2)}`;
  const ataraxiaClause =
    ataraxiaAvg === null
      ? 'sin datos suficientes de Ataraxia este mes'
      : ataraxiaAvg >= 75
        ? `con una Ataraxia promedio sólida (${ataraxiaAvg}%)`
        : ataraxiaAvg >= 36
          ? `con una Ataraxia promedio intermedia (${ataraxiaAvg}%) — hay margen real de mejora`
          : `con una Ataraxia promedio en zona de Miedo/Indisciplina (${ataraxiaAvg}%) — la ejecución no representó el plan la mayor parte del mes`;
  return `Mes cerrado con ${tradesCount} operación(es) registrada(s), ${winCount} ganadora(s) y ${lossCount} perdedora(s), ${pnlClause}, ${ataraxiaClause}.`;
}
