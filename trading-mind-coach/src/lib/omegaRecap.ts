import {
  getDisciplineInputsByDate,
  getMissionCompletionEventsInRange,
  getOperationsInRange,
  getTradingPlan,
  getWeekBounds,
  getWeeklyKillSwitchStatus,
  type OperationRecord,
} from './api';
import { computeDisciplineTimeline, type DisciplineOperationInput } from './disciplineScore';
import { tallyLabels } from './tradeMetrics';
import { buildMonthlyVerdict, buildWeeklyVerdict, CHECK_COPY } from './omegaCoachTemplates';

// Reemplazo 100% determinista de requestWeeklyRecap/requestMonthlyClose (antes
// llamaban a la Edge Function omega-coach) — mismas métricas reales que ya se
// calculaban del lado del cliente, ahora con el texto también generado por
// plantilla en vez de pedírselo a un modelo de lenguaje.

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

function actionPlanFromNegatives(topNegativeLabels: { label: string }[], negativeIdsByLabel: Map<string, string>): string[] {
  return topNegativeLabels.slice(0, 3).map((entry) => {
    const id = negativeIdsByLabel.get(entry.label);
    return id ? CHECK_COPY[id as keyof typeof CHECK_COPY].missionTask : `Corregí: ${entry.label}`;
  });
}

export async function buildWeeklyRecap(userId: string, referenceDate: Date = new Date()): Promise<WeeklyRecapResult> {
  const { weekStart, weekEnd } = getWeekBounds(referenceDate);
  const [killSwitch, missionEvents, disciplineInputs, ops, plan] = await Promise.all([
    getWeeklyKillSwitchStatus(userId, referenceDate),
    getMissionCompletionEventsInRange(userId, weekStart, weekEnd),
    getDisciplineInputsByDate(userId),
    getOperationsInRange(userId, weekStart, weekEnd),
    getTradingPlan(userId),
  ]);

  const missionsCompleted = missionEvents.length;
  const xpFromMissions = missionEvents.reduce((sum, event) => sum + event.points, 0);

  const opsByDate = new Map<string, DisciplineOperationInput[]>();
  ops.forEach((op: OperationRecord) => {
    const list = opsByDate.get(op.entry_date) ?? [];
    list.push({ model: op.model, session: op.session, brokePlan: op.broke_plan });
    opsByDate.set(op.entry_date, list);
  });
  const weekEntries = Object.fromEntries(
    Object.entries(disciplineInputs).filter(([date]) => date >= weekStart && date <= weekEnd),
  );
  const timeline = computeDisciplineTimeline(weekEntries, opsByDate, plan?.max_trades_per_session ?? null);

  const topPositives = tallyLabels(timeline.map((day) => day.positives), 1);
  const topNegatives = tallyLabels(timeline.map((day) => day.negatives), 3);
  const negativeIdsByLabel = new Map<string, string>();
  timeline.forEach((day) => day.negatives.forEach((label, i) => negativeIdsByLabel.set(label, day.negativeIds[i])));

  const recap: WeeklyRecap = {
    weekly_verdict: buildWeeklyVerdict(killSwitch.greenDays, killSwitch.redDays),
    top_strength: topPositives[0]?.label ?? 'Sin patrón positivo repetido esta semana todavía.',
    critical_leak: topNegatives[0]?.label ?? 'Sin fuga repetida detectada esta semana.',
    action_plan:
      actionPlanFromNegatives(topNegatives, negativeIdsByLabel).length > 0
        ? actionPlanFromNegatives(topNegatives, negativeIdsByLabel)
        : ['Sostené el mismo proceso que te trajo hasta acá.'],
  };

  return {
    recap,
    metrics: { greenDays: killSwitch.greenDays, redDays: killSwitch.redDays, missionsCompleted, xpFromMissions, weekStart, weekEnd },
  };
}

export async function buildMonthlyClose(userId: string, monthStart: string, monthEnd: string): Promise<MonthlyCloseResult> {
  const [ops, missionEvents, plan, disciplineInputs] = await Promise.all([
    getOperationsInRange(userId, monthStart, monthEnd),
    getMissionCompletionEventsInRange(userId, monthStart, monthEnd),
    getTradingPlan(userId),
    getDisciplineInputsByDate(userId),
  ]);

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

  const tradesCount = ops.length;
  const winCount = ops.filter((op) => op.outcome === 'TP').length;
  const lossCount = ops.filter((op) => op.outcome === 'SL').length;
  const pnlTotal = ops.reduce((sum, op) => sum + (op.pnl ?? 0), 0);
  const brokePlanCount = ops.filter((op) => op.broke_plan).length;

  const missionsCompleted = missionEvents.length;
  const xpFromMissions = missionEvents.reduce((sum, event) => sum + event.points, 0);

  const topPositives = tallyLabels(timeline.map((day) => day.positives), 1);
  const topNegatives = tallyLabels(timeline.map((day) => day.negatives), 4);
  const negativeIdsByLabel = new Map<string, string>();
  timeline.forEach((day) => day.negatives.forEach((label, i) => negativeIdsByLabel.set(label, day.negativeIds[i])));

  const monthLabel = new Date(`${monthStart}T12:00:00`).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });

  const close: MonthlyClose = {
    monthly_verdict: buildMonthlyVerdict(tradesCount, winCount, lossCount, pnlTotal, ataraxiaAvg),
    execution_summary:
      tradesCount === 0
        ? 'Sin operaciones registradas este mes.'
        : `${winCount}/${tradesCount} operaciones ganadoras, ${brokePlanCount} con ruptura de plan marcada.`,
    psychological_evolution:
      ataraxiaAvg === null
        ? 'Sin datos suficientes de Ataraxia este mes.'
        : `Ataraxia promedio del mes: ${ataraxiaAvg}%.`,
    top_strength: topPositives[0]?.label ?? 'Sin patrón positivo repetido este mes todavía.',
    critical_leak: topNegatives[0]?.label ?? 'Sin fuga repetida detectada este mes.',
    next_month_objectives:
      actionPlanFromNegatives(topNegatives.slice(0, 2), negativeIdsByLabel).length > 0
        ? actionPlanFromNegatives(topNegatives.slice(0, 2), negativeIdsByLabel)
        : ['Sostené el mismo proceso el próximo mes.'],
    action_plan:
      actionPlanFromNegatives(topNegatives, negativeIdsByLabel).length > 0
        ? actionPlanFromNegatives(topNegatives, negativeIdsByLabel)
        : ['Sostené el mismo proceso que te trajo hasta acá.'],
  };

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
}
