import { localIsoDate, summarizeOperationsByDate } from './calendar';
import { supabase } from './supabaseClient';
import { currentStage, rankPenaltyMultiplier } from './virtus';

export async function getVirtusTotal(userId: string): Promise<number> {
  const [
    { data: events, error: eventsError },
    { data: weekly, error: weeklyError },
    { data: aiEvents, error: aiEventsError },
  ] = await Promise.all([
    supabase.from('virtus_events').select('points').eq('user_id', userId),
    supabase.from('weekly_missions').select('points').eq('user_id', userId),
    supabase.from('virtus_ai_events').select('points').eq('user_id', userId),
  ]);

  if (eventsError) throw eventsError;
  if (weeklyError) throw weeklyError;
  // virtus_ai_events is a brand-new table (Omega agent) — tolerate it not
  // existing yet (Postgres "undefined_table", code 42P01) so this function
  // keeps working for accounts that haven't run that migration yet.
  if (aiEventsError && aiEventsError.code !== '42P01') throw aiEventsError;

  const eventsSum = (events ?? []).reduce((sum, row) => sum + row.points, 0);
  const weeklySum = (weekly ?? []).reduce((sum, row) => sum + row.points, 0);
  const aiEventsSum = (aiEvents ?? []).reduce((sum, row) => sum + row.points, 0);
  return eventsSum + weeklySum + aiEventsSum;
}

export async function getVirtusDelta(userId: string, sinceDays = 7): Promise<number> {
  const since = new Date();
  since.setDate(since.getDate() - sinceDays);

  const [{ data: events, error: eventsError }, { data: weekly, error: weeklyError }] = await Promise.all([
    supabase.from('virtus_events').select('points').eq('user_id', userId).gte('created_at', since.toISOString()),
    supabase
      .from('weekly_missions')
      .select('points')
      .eq('user_id', userId)
      .gte('created_at', since.toISOString()),
  ]);

  if (eventsError) throw eventsError;
  if (weeklyError) throw weeklyError;

  const eventsSum = (events ?? []).reduce((sum, row) => sum + row.points, 0);
  const weeklySum = (weekly ?? []).reduce((sum, row) => sum + row.points, 0);
  return eventsSum + weeklySum;
}

/** Sum of Virtus points earned/lost from today's own journal entry — i.e. today's session actions. */
export async function getTodaySessionVirtusDelta(userId: string, entryDate: string): Promise<number> {
  const { data: entryRow, error: entryError } = await supabase
    .from('journal_entries')
    .select('id')
    .eq('user_id', userId)
    .eq('entry_date', entryDate)
    .maybeSingle();

  if (entryError) throw entryError;
  if (!entryRow) return 0;

  const { data, error } = await supabase
    .from('virtus_events')
    .select('points')
    .eq('journal_entry_id', entryRow.id);

  if (error) throw error;
  return (data ?? []).reduce((sum, row) => sum + row.points, 0);
}

export type Direction = 'long' | 'short';
export type ExecutionWindow = 'london_open' | 'ny_am' | 'ny_pm' | 'outside_window';

export type VirtusEventInput = { label: string; points: number };

/**
 * Replaces (rather than appends) the Virtus events tied to a journal entry, so
 * re-sealing the same day's entry recalculates points instead of stacking duplicates.
 */
export async function replaceVirtusEvents(
  userId: string,
  journalEntryId: string,
  events: VirtusEventInput[],
): Promise<void> {
  const { error: deleteError } = await supabase
    .from('virtus_events')
    .delete()
    .eq('user_id', userId)
    .eq('journal_entry_id', journalEntryId);

  if (deleteError) throw deleteError;
  if (events.length === 0) return;

  const rows = events.map((event) => ({
    user_id: userId,
    journal_entry_id: journalEntryId,
    label: event.label,
    points: event.points,
  }));

  const { error: insertError } = await supabase.from('virtus_events').insert(rows);
  if (insertError) throw insertError;
}

export type TraderType = 'Scalper' | 'Day trader' | 'Swing trader' | 'Position trader';

export type SetupItem = {
  id: string;
  name: string;
  description: string;
  summary: string;
  historicalWinrate: string;
  qualityNotes: string;
  bestDays: number[];
};

export type ScenarioItem = {
  id: string;
  name: string;
  description: string;
};

export type GoalItem = {
  id: string;
  text: string;
  type: 'manual' | 'automatic';
  reward: string;
  progressPct: number;
};

export type TradingPlan = {
  trader_type: TraderType | null;
  trades_crypto: boolean;
  session_time: string | null;
  schedule_start: string | null;
  schedule_end: string | null;
  max_trades_per_session: string | null;
  no_trade_days: string | null;
  setups: SetupItem[];
  scenarios: ScenarioItem[];
  risk_management: string | null;
  position_management: string | null;
  max_weekly_drawdown: string | null;
  losing_streak_plan: string | null;
  macro_event_plan: string | null;
  psychological_rules: string | null;
  market_analysis_rules: string | null;
  capital_preservation_rules: string | null;
  payout_plan: string | null;
  goals: GoalItem[];
  extra_notes: string | null;
  quality_tiers: string[];
};

export const defaultQualityTiers = ['A+', 'A', 'B', 'No ejecuté'];

export const emptyTradingPlan: TradingPlan = {
  trader_type: null,
  trades_crypto: false,
  session_time: null,
  schedule_start: null,
  schedule_end: null,
  max_trades_per_session: null,
  no_trade_days: null,
  setups: [],
  scenarios: [],
  risk_management: null,
  position_management: null,
  max_weekly_drawdown: null,
  losing_streak_plan: null,
  macro_event_plan: null,
  psychological_rules: null,
  market_analysis_rules: null,
  capital_preservation_rules: null,
  payout_plan: null,
  goals: [],
  extra_notes: null,
  quality_tiers: defaultQualityTiers,
};

export async function getTradingPlan(userId: string): Promise<TradingPlan | null> {
  const { data, error } = await supabase
    .from('trading_plan')
    .select(
      'trader_type, trades_crypto, session_time, schedule_start, schedule_end, max_trades_per_session, no_trade_days, setups, scenarios, risk_management, position_management, max_weekly_drawdown, losing_streak_plan, macro_event_plan, psychological_rules, market_analysis_rules, capital_preservation_rules, payout_plan, goals, extra_notes, quality_tiers',
    )
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  /**
   * Rows saved before a field existed (or edited outside this app) can be
   * missing keys entirely — normalize so every consumer gets real defaults
   * instead of `undefined` leaking into inputs/sliders as misleading values
   * (e.g. a range input silently defaulting to 50%).
   */
  return {
    ...data,
    trades_crypto: data.trades_crypto ?? false,
    setups: ((data.setups ?? []) as Partial<SetupItem>[]).map((item) => ({
      id: item.id ?? crypto.randomUUID(),
      name: item.name ?? '',
      description: item.description ?? '',
      summary: item.summary ?? '',
      historicalWinrate: item.historicalWinrate ?? '',
      qualityNotes: item.qualityNotes ?? '',
      bestDays: item.bestDays ?? [],
    })),
    scenarios: ((data.scenarios ?? []) as Partial<ScenarioItem>[]).map((item) => ({
      id: item.id ?? crypto.randomUUID(),
      name: item.name ?? '',
      description: item.description ?? '',
    })),
    goals: ((data.goals ?? []) as Partial<GoalItem>[]).map((item) => ({
      id: item.id ?? crypto.randomUUID(),
      text: item.text ?? '',
      type: item.type ?? 'manual',
      reward: item.reward ?? '',
      progressPct: item.progressPct ?? 0,
    })),
    quality_tiers:
      Array.isArray(data.quality_tiers) && data.quality_tiers.length > 0
        ? (data.quality_tiers as string[])
        : defaultQualityTiers,
  } as TradingPlan;
}

/**
 * trading_plan has a UNIQUE(user_id) constraint (added alongside this feature) — one
 * plan per trader. Upsert so every autosave writes to the same row.
 */
export async function upsertTradingPlan(userId: string, plan: TradingPlan): Promise<void> {
  const { error } = await supabase
    .from('trading_plan')
    .upsert({ user_id: userId, ...plan }, { onConflict: 'user_id' });

  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Journal Entry (full page) — Fase 2
// ---------------------------------------------------------------------------

export type EmotionalState = 'Calma' | 'Confianza' | 'Ansiedad' | 'Frustración' | 'Euforia' | 'Cansancio';

export const emotionalStates: EmotionalState[] = [
  'Calma',
  'Confianza',
  'Ansiedad',
  'Frustración',
  'Euforia',
  'Cansancio',
];

export type DisciplineBreakReason =
  | 'FOMO'
  | 'Venganza'
  | 'Impaciencia'
  | 'Sobreconfianza'
  | 'Moví mi Stop Loss'
  | 'Distracción'
  | 'Otro';

export const disciplineBreakReasons: DisciplineBreakReason[] = [
  'FOMO',
  'Venganza',
  'Impaciencia',
  'Sobreconfianza',
  'Moví mi Stop Loss',
  'Distracción',
  'Otro',
];

export const topDownHtfFields = ['Monthly', 'Weekly', 'Daily', 'H8', 'H4'];
export const topDownLtfFields = [
  'H1',
  'M30',
  'M15',
  'RTH',
  'ORG',
  'Market Profile — Asia',
  'Market Profile — London',
  'Market Profile — New York',
  'Asia Range',
  'London Open',
  'London Lunch',
  'NY Open',
];

export type TopDownData = {
  htf: Record<string, string>;
  ltf: Record<string, string>;
};

export function emptyTopDown(): TopDownData {
  const htf: Record<string, string> = {};
  topDownHtfFields.forEach((field) => (htf[field] = ''));
  const ltf: Record<string, string> = {};
  topDownLtfFields.forEach((field) => (ltf[field] = ''));
  return { htf, ltf };
}

// ---------------------------------------------------------------------------
// Personalización del journal — Fase de campos configurables (Módulo 2)
// ---------------------------------------------------------------------------

export type JournalTemplateSections = {
  htf: string[];
  ltf: string[];
};

export function defaultTemplateSections(): JournalTemplateSections {
  return { htf: [...topDownHtfFields], ltf: [...topDownLtfFields] };
}

export async function getJournalTemplate(userId: string): Promise<JournalTemplateSections> {
  const { data, error } = await supabase
    .from('journal_templates')
    .select('sections')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw error;

  const sections = data?.sections as Partial<JournalTemplateSections> | undefined;
  const htf = Array.isArray(sections?.htf) && sections!.htf.length > 0 ? sections!.htf : topDownHtfFields;
  const ltf = Array.isArray(sections?.ltf) && sections!.ltf.length > 0 ? sections!.ltf : topDownLtfFields;
  return { htf, ltf };
}

/**
 * journal_templates needs a UNIQUE(user_id) constraint for this upsert to work —
 * same pattern as trading_plan (one template per user).
 */
export async function upsertJournalTemplate(userId: string, sections: JournalTemplateSections): Promise<void> {
  const { error } = await supabase
    .from('journal_templates')
    .upsert({ user_id: userId, sections, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });

  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Quiz Post-Mercado (Fase 3) — Módulo 2
// ---------------------------------------------------------------------------

export type PostMarketQuizQuestion = {
  key: string;
  label: string;
  options: string[];
};

export const postMarketQuizQuestions: PostMarketQuizQuestion[] = [
  { key: 'bias_correct', label: '¿Tu bias fue correcto?', options: ['Sí', 'No'] },
  { key: 'dol_liquidated', label: '¿Tu DOL fue liquidado?', options: ['Sí', 'No'] },
  { key: 'price_reading', label: '¿Cómo estuvo tu lectura del precio?', options: ['1', '2', '3', '4', '5'] },
  {
    key: 'narrative_respected',
    label: '¿Respetaste tu narrativa establecida en el journal pre-sesión?',
    options: ['Sí', 'No'],
  },
  { key: 'setup_params', label: '¿El setup ejecutado cumplió los parámetros?', options: ['Sí', 'No', 'No ejecuté'] },
  { key: 'risk_respected', label: '¿Respetaste tu manejo de riesgo?', options: ['Sí', 'No', 'No ejecuté'] },
  {
    key: 'psychology',
    label: '¿Cómo fue tu psicología durante el trade (de haber alguno)?',
    options: ['Mala', 'Media', 'Bien', 'Excelente'],
  },
];

export const psychologyEmotions: string[] = [
  'Ansiedad',
  'Miedo',
  'FOMO',
  'Venganza',
  'Euforia',
  'Calma',
  'Disciplina',
  'Seguridad',
  'Duda',
  'Paciencia',
  'Frustración',
  'Impaciencia',
  'Validación',
  'Codicia',
  'Desesperación',
  'Necesidad',
  'Ira',
  'Incertidumbre',
];

export type QuizAnswer = { answer: string | null; note: string };
export type QuizState = Record<string, QuizAnswer>;

export function emptyQuizState(): QuizState {
  const state: QuizState = {};
  postMarketQuizQuestions.forEach((question) => {
    state[question.key] = { answer: null, note: '' };
  });
  return state;
}

function normalizeQuizState(raw: unknown): QuizState {
  const empty = emptyQuizState();
  if (!raw || typeof raw !== 'object') return empty;

  const source = raw as Record<string, Partial<QuizAnswer>>;
  const result: QuizState = {};
  postMarketQuizQuestions.forEach((question) => {
    const saved = source[question.key];
    result[question.key] = { answer: saved?.answer ?? null, note: saved?.note ?? '' };
  });
  return result;
}

export type ScreenshotItem = { path: string; url: string };

export type MacroNewsRecord = { title: string; country: string; impact: string; time: string };

export type JournalEntryFull = {
  id: string | null;
  entry_date: string;
  emotional_state: EmotionalState | null;
  directriz: string | null;
  market_context: string | null;
  top_down: TopDownData;
  custom_fields: {
    dol_target: string;
    dol_invalidation: string;
    risk_within_plan: boolean | null;
    took_trade: boolean | null;
    quiz: QuizState;
    quiz_extra_notes: string;
    psychology_emotions: string[];
    had_macro_news: boolean | null;
    macro_news: MacroNewsRecord[] | null;
    /** Sellado por fases — ver computeVirtusEventsV2 y JournalEntry.tsx. Una vez sellada, esa fase queda inmutable. */
    phase1_sealed_at: string | null;
    phase2_sealed_at: string | null;
    /** Sello final — toda la entrada queda inmutable. */
    sealed_at: string | null;
  };
  screenshots: ScreenshotItem[];
  post_market_analysis: string | null;
  scenario_id: string | null;
  followed_scenario: boolean | null;
  discipline_break_reason: DisciplineBreakReason | null;
  discipline_break_note: string | null;
};

export function emptyJournalEntry(date: string): JournalEntryFull {
  return {
    id: null,
    entry_date: date,
    emotional_state: null,
    directriz: null,
    market_context: null,
    top_down: emptyTopDown(),
    custom_fields: {
      dol_target: '',
      dol_invalidation: '',
      risk_within_plan: null,
      took_trade: null,
      quiz: emptyQuizState(),
      quiz_extra_notes: '',
      psychology_emotions: [],
      had_macro_news: null,
      macro_news: null,
      phase1_sealed_at: null,
      phase2_sealed_at: null,
      sealed_at: null,
    },
    screenshots: [],
    post_market_analysis: null,
    scenario_id: null,
    followed_scenario: null,
    discipline_break_reason: null,
    discipline_break_note: null,
  };
}

export async function getJournalEntryByDate(userId: string, date: string): Promise<JournalEntryFull | null> {
  const { data, error } = await supabase
    .from('journal_entries')
    .select(
      'id, entry_date, emotional_state, directriz, market_context, top_down, custom_fields, screenshots, post_market_analysis, scenario_id, followed_scenario, discipline_break_reason, discipline_break_note',
    )
    .eq('user_id', userId)
    .eq('entry_date', date)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const topDown = data.top_down as Partial<TopDownData> | null;

  return {
    id: data.id,
    entry_date: data.entry_date,
    emotional_state: data.emotional_state as EmotionalState | null,
    directriz: data.directriz,
    market_context: data.market_context,
    top_down: {
      htf: { ...emptyTopDown().htf, ...(topDown?.htf ?? {}) },
      ltf: { ...emptyTopDown().ltf, ...(topDown?.ltf ?? {}) },
    },
    custom_fields: {
      dol_target: data.custom_fields?.dol_target ?? '',
      dol_invalidation: data.custom_fields?.dol_invalidation ?? '',
      risk_within_plan: data.custom_fields?.risk_within_plan ?? null,
      took_trade: data.custom_fields?.took_trade ?? null,
      quiz: normalizeQuizState(data.custom_fields?.quiz),
      quiz_extra_notes: data.custom_fields?.quiz_extra_notes ?? '',
      psychology_emotions: Array.isArray(data.custom_fields?.psychology_emotions)
        ? (data.custom_fields.psychology_emotions as string[])
        : [],
      had_macro_news: data.custom_fields?.had_macro_news ?? null,
      macro_news: data.custom_fields?.macro_news ?? null,
      phase1_sealed_at: data.custom_fields?.phase1_sealed_at ?? null,
      phase2_sealed_at: data.custom_fields?.phase2_sealed_at ?? null,
      sealed_at: data.custom_fields?.sealed_at ?? null,
    },
    screenshots: (data.screenshots ?? []) as ScreenshotItem[],
    post_market_analysis: data.post_market_analysis,
    scenario_id: data.scenario_id,
    followed_scenario: data.followed_scenario,
    discipline_break_reason: data.discipline_break_reason as DisciplineBreakReason | null,
    discipline_break_note: data.discipline_break_note,
  };
}

// El sellado por fases se lanzó este día — las entradas de antes quedan
// exentas del bloqueo/aviso (por decisión explícita del usuario: las va a
// borrar él mismo para empezar el registro desde cero, en vez de que el
// sistema le exija sellar retroactivamente todo su historial real).
const SEAL_FEATURE_LAUNCH_DATE = '2026-08-18';

/**
 * Finds the user's most recent journal entry strictly before `beforeDate`
 * (and on/after SEAL_FEATURE_LAUNCH_DATE) and reports whether it's sealed.
 * Used both to gate creating a new day's entry (block until the prior one is
 * sealed) and to power the Buzón/sidebar "journal sin sellar" reminder —
 * same query, two call sites.
 */
export async function getRecentEntrySealStatus(
  userId: string,
  beforeDate: string,
): Promise<{ entryDate: string; sealed: boolean } | null> {
  const { data, error } = await supabase
    .from('journal_entries')
    .select('entry_date, custom_fields')
    .eq('user_id', userId)
    .gte('entry_date', SEAL_FEATURE_LAUNCH_DATE)
    .lt('entry_date', beforeDate)
    .order('entry_date', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const sealedAt = (data.custom_fields as { sealed_at?: unknown } | null)?.sealed_at;
  return { entryDate: data.entry_date, sealed: typeof sealedAt === 'string' && sealedAt.length > 0 };
}

/**
 * journal_entries has a UNIQUE(user_id, entry_date) constraint — one entry per trading
 * day. Upsert so sealing the same day's entry again updates it instead of failing.
 */
export async function upsertJournalEntryFull(userId: string, entry: JournalEntryFull): Promise<string> {
  const { data, error } = await supabase
    .from('journal_entries')
    .upsert(
      {
        user_id: userId,
        entry_date: entry.entry_date,
        emotional_state: entry.emotional_state,
        directriz: entry.directriz,
        market_context: entry.market_context,
        top_down: entry.top_down,
        custom_fields: entry.custom_fields,
        screenshots: entry.screenshots,
        post_market_analysis: entry.post_market_analysis,
        scenario_id: entry.scenario_id,
        followed_scenario: entry.followed_scenario,
        discipline_break_reason: entry.discipline_break_reason,
        discipline_break_note: entry.discipline_break_note,
      },
      { onConflict: 'user_id,entry_date' },
    )
    .select('id')
    .single();

  if (error) throw error;
  return data.id as string;
}

// ---------------------------------------------------------------------------
// Operaciones (trades within a journal entry)
// ---------------------------------------------------------------------------

/**
 * Free text, not a fixed union — quality tiers are user-configurable via
 * trading_plan.quality_tiers (Módulo 2 personalización).
 */
export type OperationQuality = string;

export type OperationOutcome = 'TP' | 'SL' | 'BE';

export type OperationItem = {
  id: string;
  symbol: string;
  direction: Direction | null;
  model: string;
  quality: OperationQuality | null;
  session: ExecutionWindow | null;
  entryPrice: string;
  stopLoss: string;
  takeProfit: string;
  riskReward: string;
  pnl: string;
  outcome: OperationOutcome | null;
  lesson: string;
  brokePlan: boolean;
  screenshots: ScreenshotItem[];
  lotSize: string;
  entryTime: string | null;
  exitTime: string | null;
  brokerSource: string | null;
  isAutoSynced: boolean;
  accountLabel: string | null;
};

export function newOperation(): OperationItem {
  return {
    id: crypto.randomUUID(),
    symbol: '',
    direction: null,
    model: '',
    quality: null,
    session: null,
    entryPrice: '',
    stopLoss: '',
    takeProfit: '',
    riskReward: '',
    pnl: '',
    outcome: null,
    lesson: '',
    brokePlan: false,
    screenshots: [],
    lotSize: '',
    entryTime: null,
    exitTime: null,
    brokerSource: null,
    isAutoSynced: false,
    accountLabel: null,
  };
}

export async function getOperations(journalEntryId: string): Promise<OperationItem[]> {
  const { data, error } = await supabase
    .from('operations')
    .select(
      'id, symbol, direction, model, quality, session, entry_price, stop_loss, take_profit, risk_reward, pnl, outcome, lesson, broke_plan, screenshots, lot_size, entry_time, exit_time, broker_source, is_auto_synced, account_label',
    )
    .eq('journal_entry_id', journalEntryId)
    .order('created_at', { ascending: true });

  if (error) throw error;

  return (data ?? []).map((row) => ({
    id: row.id,
    symbol: row.symbol,
    direction: row.direction as Direction,
    model: row.model ?? '',
    quality: row.quality as OperationQuality | null,
    session: row.session as ExecutionWindow | null,
    entryPrice: row.entry_price?.toString() ?? '',
    stopLoss: row.stop_loss?.toString() ?? '',
    takeProfit: row.take_profit?.toString() ?? '',
    riskReward: row.risk_reward ?? '',
    pnl: row.pnl?.toString() ?? '',
    outcome: row.outcome as OperationOutcome | null,
    lesson: row.lesson ?? '',
    brokePlan: row.broke_plan,
    screenshots: Array.isArray(row.screenshots) ? (row.screenshots as ScreenshotItem[]) : [],
    lotSize: row.lot_size?.toString() ?? '',
    entryTime: row.entry_time,
    exitTime: row.exit_time,
    brokerSource: row.broker_source,
    isAutoSynced: Boolean(row.is_auto_synced),
    accountLabel: row.account_label,
  }));
}

function toNumberOrNull(value: string): number | null {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Replaces every operation tied to a journal entry — simplest way to keep a
 * client-side repeatable list (add/edit/remove rows freely) in sync with the DB
 * without diffing individual row changes.
 */
export async function replaceOperations(
  userId: string,
  journalEntryId: string,
  entryDate: string,
  operations: OperationItem[],
): Promise<void> {
  const { error: deleteError } = await supabase
    .from('operations')
    .delete()
    .eq('journal_entry_id', journalEntryId);
  if (deleteError) throw deleteError;

  const validOps = operations.filter((op) => op.symbol.trim() && op.direction);
  if (validOps.length === 0) return;

  const rows = validOps.map((op) => ({
    journal_entry_id: journalEntryId,
    user_id: userId,
    entry_date: entryDate,
    symbol: op.symbol.trim().toUpperCase(),
    direction: op.direction,
    model: op.model || null,
    quality: op.quality,
    session: op.session,
    entry_price: toNumberOrNull(op.entryPrice),
    stop_loss: toNumberOrNull(op.stopLoss),
    take_profit: toNumberOrNull(op.takeProfit),
    risk_reward: op.riskReward || null,
    pnl: toNumberOrNull(op.pnl),
    outcome: op.outcome,
    lesson: op.lesson || null,
    broke_plan: op.brokePlan,
    screenshots: op.screenshots,
    lot_size: toNumberOrNull(op.lotSize),
    entry_time: op.entryTime,
    exit_time: op.exitTime,
    broker_source: op.brokerSource,
    is_auto_synced: op.isAutoSynced,
    account_label: op.accountLabel,
  }));

  const { error: insertError } = await supabase.from('operations').insert(rows);
  if (insertError) throw insertError;
}

// ---------------------------------------------------------------------------
// Trade Sync — importación de operaciones por CSV (Fase 2)
// ---------------------------------------------------------------------------

/**
 * Busca la entrada del journal de esa fecha; si no existe, crea una vacía con
 * un INSERT simple (nunca upsert) para no arriesgarse a pisar una entrada con
 * contenido real ya guardado.
 */
export async function ensureJournalEntryForDate(userId: string, date: string): Promise<string> {
  const existing = await getJournalEntryByDate(userId, date);
  if (existing?.id) return existing.id;

  const { data, error } = await supabase
    .from('journal_entries')
    .insert({ user_id: userId, entry_date: date })
    .select('id')
    .single();

  if (error) throw error;
  return data.id as string;
}

export type SyncedTradeInput = {
  ticker: string;
  direction: Direction | null;
  lotSize: number | null;
  entryTime: string | null;
  exitTime: string | null;
  netPnl: number | null;
};

/**
 * A diferencia de replaceOperations (que borra y reinserta TODO), esto solo
 * inserta — así una importación nunca toca operaciones ya existentes de ese
 * día (manuales o sincronizadas de una carga anterior). Evita duplicar si el
 * mismo CSV se sube dos veces comparando símbolo+hora de entrada+P&L contra
 * lo que ya está sincronizado en esa entrada.
 */
export async function insertSyncedOperations(
  userId: string,
  journalEntryId: string,
  entryDate: string,
  trades: SyncedTradeInput[],
  brokerSource: string,
  accountLabel: string | null = null,
): Promise<number> {
  if (trades.length === 0) return 0;

  const { data: existingRows, error: existingError } = await supabase
    .from('operations')
    .select('symbol, entry_time, pnl, account_label')
    .eq('journal_entry_id', journalEntryId)
    .eq('is_auto_synced', true);
  if (existingError) throw existingError;

  // Compara por epoch ms (no por string) porque Postgres devuelve los
  // timestamps en un formato distinto ("+00:00", sin milisegundos) al que
  // produce el parser (.toISOString(), sufijo "Z") — comparar los strings
  // crudos nunca matchea aunque sean el mismo instante. La cuenta entra en la
  // clave para no confundir dos cuentas distintas con un trade "igual" por
  // coincidencia (mismo símbolo/hora/P&L).
  const dedupeKey = (symbol: string, entryTime: string | null, pnl: number | null, account: string | null) => {
    const timeKey = entryTime ? new Date(entryTime).getTime() : null;
    const pnlKey = pnl === null ? null : Math.round(pnl * 100);
    return `${symbol.trim().toUpperCase()}|${timeKey}|${pnlKey}|${account ?? ''}`;
  };

  const existingKeys = new Set(
    (existingRows ?? []).map((row) => dedupeKey(row.symbol, row.entry_time, row.pnl, row.account_label)),
  );

  const rows = trades
    .filter((trade) => !existingKeys.has(dedupeKey(trade.ticker, trade.entryTime, trade.netPnl, accountLabel)))
    .map((trade) => ({
      journal_entry_id: journalEntryId,
      user_id: userId,
      entry_date: entryDate,
      symbol: trade.ticker.trim().toUpperCase(),
      direction: trade.direction,
      lot_size: trade.lotSize,
      entry_time: trade.entryTime,
      exit_time: trade.exitTime,
      pnl: trade.netPnl,
      broker_source: brokerSource,
      is_auto_synced: true,
      account_label: accountLabel,
    }));

  if (rows.length === 0) return 0;

  const { error } = await supabase.from('operations').insert(rows);
  if (error) throw error;
  return rows.length;
}

// ---------------------------------------------------------------------------
// Virtus engine v2 — derived from real journal/operations fields
// Point values per .claude/CLAUDE_INSTRUCTIONS.md — Sistema de Gamificación,
// plus two "misiones diarias" reinterpreted as Virtus points.
// ---------------------------------------------------------------------------

// Duplicado deliberadamente en vez de importar desde disciplineScore.ts —
// ese módulo importa tipos de este archivo, e importar el valor de vuelta
// crearía un ciclo de módulos. Debe mantenerse igual a `constructiveEmotions`.
const constructiveEmotionsSet = new Set(['Calma', 'Disciplina', 'Seguridad', 'Paciencia']);

/** true solo si hay al menos una emoción marcada y todas son constructivas — mismo criterio que CONSTRUCTIVE_EMOTIONAL_STATE de abajo, expuesto para la misión "No tuve emociones negativas". */
export function hasOnlyConstructiveEmotions(emotions: string[]): boolean {
  return emotions.length > 0 && emotions.every((emotion) => constructiveEmotionsSet.has(emotion));
}

// Contexto de sinergia Ataraxia × Virtus — ver computeVirtusEventsV2.
export type VirtusSynergyContext = {
  /** Ataraxia (0-100) de la sesión que se está guardando; null si no hay datos suficientes. */
  areteScoreToday: number | null;
  /** true si hoy es la 3ª sesión consecutiva (incluyendo hoy) con Ataraxia ≥75%. */
  areteFlowStreakActive: boolean;
  /** Total de puntos Virtus acumulados ANTES de esta sesión — define el rango vigente. */
  virtusTotalBeforeToday: number;
};

export function computeVirtusEventsV2(
  entry: JournalEntryFull,
  operations: OperationItem[],
  synergy: VirtusSynergyContext,
): VirtusEventInput[] {
  const events: VirtusEventInput[] = [];

  // Adherencia al plan: se lee del checkbox real "No respeté mi plan en
  // esta operación" de cada operación — el campo viejo `followed_scenario`
  // ya no tiene ningún control en la interfaz, así que dejó de usarse aquí.
  if (operations.length > 0) {
    const anyOperationBrokePlan = operations.some((op) => op.brokePlan);
    if (anyOperationBrokePlan) {
      events.push({ label: 'BROKE_PLAN', points: -50 });
    } else {
      events.push({ label: 'PLAN_ADHERENCE', points: 50 });
    }
  }

  // Cada regla verificable tiene el mismo peso en ambas direcciones: lo que
  // se gana por cumplirla es exactamente lo que se pierde por incumplirla.
  // Manejo de riesgo: se lee de la respuesta real del Quiz Post-Mercado —
  // el campo viejo `custom_fields.risk_within_plan` ya no tiene control en
  // la interfaz, así que dejó de usarse aquí.
  if (entry.custom_fields.quiz.risk_respected?.answer === 'Sí') {
    events.push({ label: 'RISK_MANAGED', points: 40 });
  } else if (entry.custom_fields.quiz.risk_respected?.answer === 'No') {
    events.push({ label: 'RISK_NOT_RESPECTED', points: -40 });
  }

  // Control emocional: reemplaza la vieja "NO_EMOTIONAL_EXIT", ahora leída
  // de las emociones predominantes que el trader realmente marca en el
  // Quiz Post-Mercado en vez de un campo sin control en pantalla.
  if (entry.custom_fields.psychology_emotions.length > 0) {
    const constructiveCount = entry.custom_fields.psychology_emotions.filter((emotion) =>
      constructiveEmotionsSet.has(emotion),
    ).length;
    const destructiveCount = entry.custom_fields.psychology_emotions.length - constructiveCount;
    if (constructiveCount >= destructiveCount) {
      events.push({ label: 'CONSTRUCTIVE_EMOTIONAL_STATE', points: 20 });
    } else {
      events.push({ label: 'DESTRUCTIVE_EMOTIONAL_STATE', points: -20 });
    }
  }

  const anyOptimalWindow = operations.some((op) => op.session && op.session !== 'outside_window');
  const anyOutsideWindow = operations.some((op) => op.session === 'outside_window');
  if (anyOptimalWindow) {
    events.push({ label: 'OPTIMAL_TIME_DELIVERY', points: 30 });
  }
  if (anyOutsideWindow) {
    events.push({ label: 'OUTSIDE_TIME_WINDOW', points: -30 });
  }

  if (entry.custom_fields.quiz.bias_correct?.answer === 'Sí') {
    events.push({ label: 'CORRECT_BIAS', points: 15 });
  } else if (entry.custom_fields.quiz.bias_correct?.answer === 'No') {
    events.push({ label: 'WRONG_BIAS', points: -15 });
  }

  if (entry.custom_fields.quiz.setup_params?.answer === 'Sí') {
    events.push({ label: 'VALID_SETUP_EXECUTED', points: 25 });
  } else if (entry.custom_fields.quiz.setup_params?.answer === 'No') {
    events.push({ label: 'INVALID_SETUP_EXECUTED', points: -25 });
  }

  if (entry.custom_fields.quiz.narrative_respected?.answer === 'Sí') {
    events.push({ label: 'NARRATIVE_RESPECTED', points: 20 });
  } else if (entry.custom_fields.quiz.narrative_respected?.answer === 'No') {
    events.push({ label: 'NARRATIVE_NOT_RESPECTED', points: -20 });
  }

  if (entry.emotional_state) {
    events.push({ label: 'MISSION_EMOTIONAL_STATE', points: 5 });
  }
  if (operations.length > 0) {
    events.push({ label: 'MISSION_JOURNAL_COMPLETED', points: 10 });
  }
  if (entry.directriz && entry.directriz.trim().length > 0) {
    events.push({ label: 'MISSION_DIRECTRIZ_DEFINED', points: 5 });
  }
  if (postMarketQuizQuestions.every((question) => entry.custom_fields.quiz[question.key]?.answer !== null)) {
    events.push({ label: 'MISSION_QUIZ_COMPLETED', points: 15 });
  }

  // --- Sinergia Ataraxia × Virtus ------------------------------------------
  // Buff de Flujo: racha de 3 sesiones en Zona Zafiro → +20% a todo lo positivo.
  // Nerf por Tilt: Ataraxia de hoy en Zona Roja (≤35%) → ×1.5 a las penalizaciones.
  // Carga del Rango: entre más alto el rango vigente, más pesan los errores.
  const rankMultiplier = rankPenaltyMultiplier(currentStage(synergy.virtusTotalBeforeToday).level);
  const tiltActive = synergy.areteScoreToday !== null && synergy.areteScoreToday <= 35;
  const positiveMultiplier = synergy.areteFlowStreakActive ? 1.2 : 1;
  const negativeMultiplier = rankMultiplier * (tiltActive ? 1.5 : 1);

  return events.map((event) =>
    event.points > 0
      ? { ...event, points: Math.round(event.points * positiveMultiplier) }
      : { ...event, points: Math.round(event.points * negativeMultiplier) },
  );
}

// ---------------------------------------------------------------------------
// Screenshots (Supabase Storage)
// ---------------------------------------------------------------------------

const SCREENSHOTS_BUCKET = 'journal-screenshots';
const SIGNED_URL_TTL_SECONDS = 60 * 60 * 24 * 7;

export async function uploadScreenshot(
  userId: string,
  entryDate: string,
  file: File | Blob,
  filename: string,
  scope?: string,
): Promise<ScreenshotItem> {
  const path = `${userId}/${entryDate}/${scope ? `${scope}/` : ''}${Date.now()}-${filename}`;
  const { error: uploadError } = await supabase.storage.from(SCREENSHOTS_BUCKET).upload(path, file);
  if (uploadError) throw uploadError;

  const { data, error: signError } = await supabase.storage
    .from(SCREENSHOTS_BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
  if (signError) throw signError;

  return { path, url: data.signedUrl };
}

export async function removeScreenshot(path: string): Promise<void> {
  const { error } = await supabase.storage.from(SCREENSHOTS_BUCKET).remove([path]);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Social — amigos y compartir
// ---------------------------------------------------------------------------

export type Friend = { userId: string; label: string; lastSeenAt: string | null };

export async function getFriends(userId: string): Promise<Friend[]> {
  const { data, error } = await supabase
    .from('friend_requests')
    .select('from_user, to_user, status')
    .eq('status', 'accepted')
    .or(`from_user.eq.${userId},to_user.eq.${userId}`);

  if (error) throw error;

  const friendIds = (data ?? []).map((row) => (row.from_user === userId ? row.to_user : row.from_user));
  if (friendIds.length === 0) return [];

  const { data: profiles, error: profileError } = await supabase
    .from('profiles')
    .select('id, email, display_name, last_seen_at')
    .in('id', friendIds);

  if (profileError) throw profileError;

  return (profiles ?? []).map((profile) => ({
    userId: profile.id,
    label: profile.display_name || profile.email,
    lastSeenAt: profile.last_seen_at,
  }));
}

/** Actualiza el "heartbeat" de presencia del usuario actual. Se llama periódicamente mientras la app está abierta. */
export async function touchPresence(userId: string): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({ last_seen_at: new Date().toISOString() })
    .eq('id', userId);

  if (error) throw error;
}

export async function getMyProfile(userId: string): Promise<{ displayName: string | null }> {
  const { data, error } = await supabase.from('profiles').select('display_name').eq('id', userId).maybeSingle();
  if (error) throw error;
  return { displayName: data?.display_name ?? null };
}

export async function updateDisplayName(userId: string, displayName: string): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({ display_name: displayName.trim() || null })
    .eq('id', userId);

  if (error) throw error;
}

/**
 * Returns the highest Virtus total this user has ever reached, ratcheting the
 * stored peak upward if currentTotal is a new high. Lets the XP bar show a
 * benchmark of your best-ever position even after a penalty drops you below it.
 */
export async function getVirtusPeak(userId: string, currentTotal: number): Promise<number> {
  const { data, error } = await supabase
    .from('profiles')
    .select('peak_virtus_total')
    .eq('id', userId)
    .maybeSingle();

  if (error) throw error;
  const storedPeak = data?.peak_virtus_total ?? 0;
  if (currentTotal <= storedPeak) return storedPeak;

  const { error: updateError } = await supabase
    .from('profiles')
    .update({ peak_virtus_total: currentTotal })
    .eq('id', userId);

  if (updateError) throw updateError;
  return currentTotal;
}

export async function shareJournalEntry(
  fromUser: string,
  toUser: string,
  journalEntryId: string,
): Promise<void> {
  const { error } = await supabase
    .from('journal_shares')
    .insert({ from_user: fromUser, to_user: toUser, journal_entry_id: journalEntryId });

  if (error) throw error;
}

export async function getRecentShareFriendOrder(userId: string, limit = 200): Promise<string[]> {
  const { data, error } = await supabase
    .from('journal_shares')
    .select('to_user, created_at')
    .eq('from_user', userId)
    .is('agora_id', null)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;

  const seen = new Set<string>();
  const order: string[] = [];
  for (const row of data ?? []) {
    if (!seen.has(row.to_user)) {
      seen.add(row.to_user);
      order.push(row.to_user);
    }
  }
  return order;
}

export async function getRecentShareAgoraOrder(userId: string, limit = 200): Promise<string[]> {
  const { data, error } = await supabase
    .from('journal_shares')
    .select('agora_id, created_at')
    .eq('from_user', userId)
    .not('agora_id', 'is', null)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;

  const seen = new Set<string>();
  const order: string[] = [];
  for (const row of data ?? []) {
    if (row.agora_id && !seen.has(row.agora_id)) {
      seen.add(row.agora_id);
      order.push(row.agora_id);
    }
  }
  return order;
}

// ---------------------------------------------------------------------------
// Ágoras — grupos privados de trading (Módulo 5D)
// ---------------------------------------------------------------------------

export type Agora = { id: string; name: string; ownerId: string; memberCount: number };
export type AgoraMember = { userId: string; label: string; isOwner: boolean; isAdmin: boolean };

export async function createAgora(userId: string, name: string): Promise<string> {
  const { data, error } = await supabase
    .from('agoras')
    .insert({ name: name.trim(), owner_id: userId })
    .select('id')
    .single();

  if (error) throw error;

  const { error: memberError } = await supabase
    .from('agora_members')
    .insert({ agora_id: data.id, user_id: userId });

  if (memberError) throw memberError;
  return data.id;
}

export async function getMyAgoras(userId: string): Promise<Agora[]> {
  const { data: memberships, error } = await supabase
    .from('agora_members')
    .select('agora_id, agoras(id, name, owner_id, created_at)')
    .eq('user_id', userId);

  if (error) throw error;

  const rows = (memberships ?? []) as unknown as Array<{
    agora_id: string;
    agoras: { id: string; name: string; owner_id: string; created_at: string } | null;
  }>;
  const agoraList = rows
    .map((row) => row.agoras)
    .filter((a): a is { id: string; name: string; owner_id: string; created_at: string } => a !== null)
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1));

  if (agoraList.length === 0) return [];

  const ids = agoraList.map((a) => a.id);
  const { data: allMembers, error: membersError } = await supabase
    .from('agora_members')
    .select('agora_id')
    .in('agora_id', ids);

  if (membersError) throw membersError;

  const countByAgora = new Map<string, number>();
  (allMembers ?? []).forEach((m) => countByAgora.set(m.agora_id, (countByAgora.get(m.agora_id) ?? 0) + 1));

  return agoraList.map((a) => ({
    id: a.id,
    name: a.name,
    ownerId: a.owner_id,
    memberCount: countByAgora.get(a.id) ?? 1,
  }));
}

export async function getAgoraMembers(agoraId: string): Promise<AgoraMember[]> {
  const { data, error } = await supabase.from('agoras').select('owner_id').eq('id', agoraId).single();
  if (error) throw error;
  const ownerId = data.owner_id;

  const { data: members, error: membersError } = await supabase
    .from('agora_members')
    .select('user_id, role')
    .eq('agora_id', agoraId);
  if (membersError) throw membersError;

  const userIds = (members ?? []).map((m) => m.user_id);
  if (userIds.length === 0) return [];

  const roleByUser = new Map((members ?? []).map((m) => [m.user_id, m.role as string | null]));

  const { data: profiles, error: profileError } = await supabase
    .from('profiles')
    .select('id, email, display_name')
    .in('id', userIds);
  if (profileError) throw profileError;

  return (profiles ?? []).map((profile) => ({
    userId: profile.id,
    label: profile.display_name || profile.email,
    isOwner: profile.id === ownerId,
    isAdmin: roleByUser.get(profile.id) === 'admin',
  }));
}

export async function setAgoraMemberRole(
  agoraId: string,
  userId: string,
  role: 'member' | 'admin',
): Promise<void> {
  const { error } = await supabase
    .from('agora_members')
    .update({ role })
    .eq('agora_id', agoraId)
    .eq('user_id', userId);

  if (error) throw error;
}

/**
 * Calls a SECURITY DEFINER function that checks shared-Ágora membership
 * server-side and returns only the derived Virtus stage — never raw points.
 * Mirrors getFriendVirtusStage's privacy pattern for Fraternidad.
 */
export async function getAgoraMemberVirtusStage(targetUserId: string): Promise<string | null> {
  const { data, error } = await supabase.rpc('get_agora_member_virtus_stage', { target_user: targetUserId });
  if (error) throw error;
  return (data as string | null) ?? null;
}

export async function addAgoraMember(agoraId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from('agora_members')
    .upsert({ agora_id: agoraId, user_id: userId }, { onConflict: 'agora_id,user_id', ignoreDuplicates: true });

  if (error) throw error;
}

export async function removeAgoraMember(agoraId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from('agora_members')
    .delete()
    .eq('agora_id', agoraId)
    .eq('user_id', userId);

  if (error) throw error;
}

export async function deleteAgora(agoraId: string): Promise<void> {
  const { error } = await supabase.from('agoras').delete().eq('id', agoraId);
  if (error) throw error;
}

export type AgoraSearchResult = { id: string; name: string; memberCount: number };

export async function searchAgoras(query: string): Promise<AgoraSearchResult[]> {
  const { data, error } = await supabase.rpc('search_agoras', { query: query.trim() });
  if (error) throw error;
  return ((data ?? []) as Array<{ id: string; name: string; member_count: number }>).map((row) => ({
    id: row.id,
    name: row.name,
    memberCount: row.member_count,
  }));
}

export type AgoraJoinRequestStatus = 'pending' | 'accepted' | 'rejected';

export async function getAgoraJoinRequestStatus(
  agoraId: string,
  userId: string,
): Promise<{ id: string; status: AgoraJoinRequestStatus } | null> {
  const { data, error } = await supabase
    .from('agora_join_requests')
    .select('id, status')
    .eq('agora_id', agoraId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw error;
  return data as { id: string; status: AgoraJoinRequestStatus } | null;
}

export async function requestAgoraAccess(agoraId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from('agora_join_requests')
    .insert({ agora_id: agoraId, user_id: userId, status: 'pending' });

  if (error) throw error;
}

export async function getPendingAgoraRequestsCount(userId: string): Promise<number> {
  const { data: owned, error: ownedError } = await supabase.from('agoras').select('id').eq('owner_id', userId);
  if (ownedError) throw ownedError;

  const agoraIds = (owned ?? []).map((a) => a.id);
  if (agoraIds.length === 0) return 0;

  const { count, error } = await supabase
    .from('agora_join_requests')
    .select('id', { count: 'exact', head: true })
    .in('agora_id', agoraIds)
    .eq('status', 'pending');

  if (error) throw error;
  return count ?? 0;
}

export type PendingAgoraRequest = {
  id: string;
  agoraId: string;
  agoraName: string;
  fromUserId: string;
  label: string;
  createdAt: string;
};

export async function getPendingAgoraRequests(userId: string): Promise<PendingAgoraRequest[]> {
  const { data: owned, error: ownedError } = await supabase.from('agoras').select('id, name').eq('owner_id', userId);
  if (ownedError) throw ownedError;

  const agoraIds = (owned ?? []).map((a) => a.id);
  if (agoraIds.length === 0) return [];
  const agoraNameById = new Map((owned ?? []).map((a) => [a.id, a.name]));

  const { data, error } = await supabase
    .from('agora_join_requests')
    .select('id, agora_id, user_id, created_at')
    .in('agora_id', agoraIds)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });

  if (error) throw error;

  const rows = data ?? [];
  const fromIds = [...new Set(rows.map((row) => row.user_id))];
  if (fromIds.length === 0) return [];

  const { data: profiles, error: profileError } = await supabase
    .from('profiles')
    .select('id, email, display_name')
    .in('id', fromIds);
  if (profileError) throw profileError;

  const labelById = new Map((profiles ?? []).map((profile) => [profile.id, profile.display_name || profile.email]));

  return rows.map((row) => ({
    id: row.id,
    agoraId: row.agora_id,
    agoraName: agoraNameById.get(row.agora_id) ?? 'Ágora',
    fromUserId: row.user_id,
    label: labelById.get(row.user_id) ?? 'Alguien',
    createdAt: row.created_at,
  }));
}

export async function respondToAgoraRequest(requestId: string, accept: boolean): Promise<void> {
  if (accept) {
    const { data, error } = await supabase
      .from('agora_join_requests')
      .select('agora_id, user_id')
      .eq('id', requestId)
      .single();
    if (error) throw error;

    await addAgoraMember(data.agora_id, data.user_id);
  }

  const { error: updateError } = await supabase
    .from('agora_join_requests')
    .update({ status: accept ? 'accepted' : 'rejected', responded_at: new Date().toISOString() })
    .eq('id', requestId);

  if (updateError) throw updateError;
}

export async function shareJournalEntryToAgora(
  fromUser: string,
  journalEntryId: string,
  agoraId: string,
): Promise<number> {
  const { data: members, error } = await supabase
    .from('agora_members')
    .select('user_id')
    .eq('agora_id', agoraId);

  if (error) throw error;

  const recipients = (members ?? []).map((m) => m.user_id).filter((id) => id !== fromUser);
  if (recipients.length === 0) return 0;

  const rows = recipients.map((toUser) => ({
    from_user: fromUser,
    to_user: toUser,
    journal_entry_id: journalEntryId,
    agora_id: agoraId,
  }));

  const { error: insertError } = await supabase
    .from('journal_shares')
    .upsert(rows, { onConflict: 'journal_entry_id,to_user', ignoreDuplicates: true });
  if (insertError) throw insertError;
  return recipients.length;
}

// ---------------------------------------------------------------------------
// Ágoras — panel dedicado (miembros, mensajes, journals, archivos)
// ---------------------------------------------------------------------------

export async function getAgoraById(agoraId: string): Promise<Agora | null> {
  const { data, error } = await supabase
    .from('agoras')
    .select('id, name, owner_id')
    .eq('id', agoraId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const { count, error: countError } = await supabase
    .from('agora_members')
    .select('user_id', { count: 'exact', head: true })
    .eq('agora_id', agoraId);
  if (countError) throw countError;

  return { id: data.id, name: data.name, ownerId: data.owner_id, memberCount: count ?? 1 };
}

export type AgoraMessage = {
  id: string;
  authorId: string;
  authorLabel: string;
  message: string;
  createdAt: string;
};

export async function getAgoraMessages(agoraId: string): Promise<AgoraMessage[]> {
  const { data, error } = await supabase
    .from('agora_messages')
    .select('id, author_id, message, created_at')
    .eq('agora_id', agoraId)
    .order('created_at', { ascending: true });
  if (error) throw error;

  const rows = data ?? [];
  const authorIds = [...new Set(rows.map((row) => row.author_id))];
  if (authorIds.length === 0) return [];

  const { data: profiles, error: profileError } = await supabase
    .from('profiles')
    .select('id, email, display_name')
    .in('id', authorIds);
  if (profileError) throw profileError;

  const labelById = new Map((profiles ?? []).map((profile) => [profile.id, profile.display_name || profile.email]));

  return rows.map((row) => ({
    id: row.id,
    authorId: row.author_id,
    authorLabel: labelById.get(row.author_id) ?? 'Alguien',
    message: row.message,
    createdAt: row.created_at,
  }));
}

export async function sendAgoraMessage(agoraId: string, authorId: string, message: string): Promise<void> {
  const { error } = await supabase
    .from('agora_messages')
    .insert({ agora_id: agoraId, author_id: authorId, message });
  if (error) throw error;
}

const AGORA_FILES_BUCKET = 'agora-files';

export type AgoraFile = {
  id: string;
  fileName: string;
  title: string | null;
  storagePath: string;
  url: string;
  uploaderId: string;
  uploaderLabel: string;
  sizeBytes: number | null;
  createdAt: string;
};

export async function getAgoraFiles(agoraId: string): Promise<AgoraFile[]> {
  const { data, error } = await supabase
    .from('agora_files')
    .select('id, uploader_id, file_name, title, storage_path, size_bytes, created_at')
    .eq('agora_id', agoraId)
    .order('created_at', { ascending: false });
  if (error) throw error;

  const rows = data ?? [];
  const uploaderIds = [...new Set(rows.map((row) => row.uploader_id))];
  const labelById = new Map<string, string>();
  if (uploaderIds.length > 0) {
    const { data: profiles, error: profileError } = await supabase
      .from('profiles')
      .select('id, email, display_name')
      .in('id', uploaderIds);
    if (profileError) throw profileError;
    (profiles ?? []).forEach((profile) => labelById.set(profile.id, profile.display_name || profile.email));
  }

  const signed = await Promise.all(
    rows.map((row) =>
      supabase.storage.from(AGORA_FILES_BUCKET).createSignedUrl(row.storage_path, SIGNED_URL_TTL_SECONDS),
    ),
  );

  return rows.map((row, index) => ({
    id: row.id,
    fileName: row.file_name,
    title: row.title,
    storagePath: row.storage_path,
    url: signed[index].data?.signedUrl ?? '',
    uploaderId: row.uploader_id,
    uploaderLabel: labelById.get(row.uploader_id) ?? 'Alguien',
    sizeBytes: row.size_bytes,
    createdAt: row.created_at,
  }));
}

export async function uploadAgoraFile(
  agoraId: string,
  uploaderId: string,
  file: File,
  title?: string,
): Promise<void> {
  const path = `${agoraId}/${Date.now()}-${file.name}`;
  const { error: uploadError } = await supabase.storage.from(AGORA_FILES_BUCKET).upload(path, file);
  if (uploadError) throw uploadError;

  const { error } = await supabase.from('agora_files').insert({
    agora_id: agoraId,
    uploader_id: uploaderId,
    file_name: file.name,
    title: title?.trim() || null,
    storage_path: path,
    size_bytes: file.size,
  });
  if (error) throw error;
}

export async function removeAgoraFile(fileId: string, storagePath: string): Promise<void> {
  const { error: storageError } = await supabase.storage.from(AGORA_FILES_BUCKET).remove([storagePath]);
  if (storageError) throw storageError;

  const { error } = await supabase.from('agora_files').delete().eq('id', fileId);
  if (error) throw error;
}

export type AgoraSharedEntry = {
  id: string;
  journalEntryId: string;
  entryDate: string;
  fromUserId: string;
  fromLabel: string;
  createdAt: string;
};

export async function getAgoraSharedEntries(agoraId: string, limit = 100): Promise<AgoraSharedEntry[]> {
  const { data, error } = await supabase
    .from('journal_shares')
    .select('id, from_user, journal_entry_id, created_at, journal_entries(entry_date)')
    .eq('agora_id', agoraId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;

  const rows = (data ?? []) as unknown as Array<{
    id: string;
    from_user: string;
    journal_entry_id: string;
    created_at: string;
    journal_entries: { entry_date: string } | null;
  }>;

  const fromIds = [...new Set(rows.map((row) => row.from_user))];
  if (fromIds.length === 0) return [];

  const { data: profiles, error: profileError } = await supabase
    .from('profiles')
    .select('id, email, display_name')
    .in('id', fromIds);
  if (profileError) throw profileError;

  const labelById = new Map((profiles ?? []).map((profile) => [profile.id, profile.display_name || profile.email]));

  return rows.map((row) => ({
    id: row.id,
    journalEntryId: row.journal_entry_id,
    entryDate: row.journal_entries?.entry_date ?? '',
    fromUserId: row.from_user,
    fromLabel: labelById.get(row.from_user) ?? 'Alguien',
    createdAt: row.created_at,
  }));
}

// ---------------------------------------------------------------------------
// Inicio — Fase 3
// ---------------------------------------------------------------------------

export type TodayStatus = {
  hasEntry: boolean;
  emotionalStateSet: boolean;
  operationsCount: number;
  directrizSet: boolean;
  quizCompleted: boolean;
};

export async function getTodayStatus(userId: string, date: string): Promise<TodayStatus> {
  const entry = await getJournalEntryByDate(userId, date);
  if (!entry || !entry.id) {
    return {
      hasEntry: false,
      emotionalStateSet: false,
      operationsCount: 0,
      directrizSet: false,
      quizCompleted: false,
    };
  }

  const ops = await getOperations(entry.id);
  return {
    hasEntry: true,
    emotionalStateSet: entry.emotional_state !== null,
    operationsCount: ops.length,
    directrizSet: Boolean(entry.directriz && entry.directriz.trim().length > 0),
    quizCompleted: postMarketQuizQuestions.every(
      (question) => entry.custom_fields.quiz[question.key]?.answer !== null,
    ),
  };
}

/**
 * Catálogo fijo de "Misiones de hoy" — cada una se verifica sola contra
 * datos reales (TodayStatus), nunca por autoreporte, así que son las únicas
 * elegibles para el Museo de Medallas (necesitan una identidad estable y
 * anti-trampa para poder contar repeticiones).
 */
export type CoreDailyMissionDef = {
  key: string;
  label: string;
  difficulty: 'FÁCIL' | 'MEDIA';
  points: number;
  isDone: (status: TodayStatus) => boolean;
};

export const coreDailyMissionDefinitions: CoreDailyMissionDef[] = [
  {
    key: 'MISSION_EMOTIONAL_STATE',
    label: 'Registra tu estado emocional de hoy',
    difficulty: 'FÁCIL',
    points: 5,
    isDone: (status) => status.emotionalStateSet,
  },
  {
    key: 'MISSION_DIRECTRIZ_DEFINED',
    label: 'Define tu Directriz Operativa antes de operar',
    difficulty: 'FÁCIL',
    points: 5,
    isDone: (status) => status.directrizSet,
  },
  {
    key: 'MISSION_JOURNAL_COMPLETED',
    label: 'Completa tu journal con al menos una operación',
    difficulty: 'MEDIA',
    points: 10,
    isDone: (status) => status.operationsCount > 0,
  },
  {
    key: 'MISSION_QUIZ_COMPLETED',
    label: 'Completa el Quiz Post-Mercado',
    difficulty: 'MEDIA',
    points: 15,
    isDone: (status) => status.quizCompleted,
  },
];

/**
 * Registra en core_mission_completions cada misión diaria cumplida ese día —
 * se llama al sellar (junto a replaceVirtusEvents). `ignoreDuplicates` evita
 * duplicar el conteo si el mismo día se vuelve a sellar tras una edición.
 */
export async function logCoreMissionCompletions(
  userId: string,
  entryDate: string,
  status: TodayStatus,
): Promise<void> {
  const completedKeys = coreDailyMissionDefinitions
    .filter((mission) => mission.isDone(status))
    .map((mission) => mission.key);
  if (completedKeys.length === 0) return;

  const rows = completedKeys.map((key) => ({ user_id: userId, mission_key: key, entry_date: entryDate }));
  const { error } = await supabase
    .from('core_mission_completions')
    .upsert(rows, { onConflict: 'user_id,mission_key,entry_date', ignoreDuplicates: true });
  if (error) throw error;
}

export type MissionCompletionCounts = Record<string, number>;

export async function getCoreMissionCompletionCounts(userId: string): Promise<MissionCompletionCounts> {
  const { data, error } = await supabase.from('core_mission_completions').select('mission_key').eq('user_id', userId);
  if (error) throw error;

  const counts: MissionCompletionCounts = {};
  (data ?? []).forEach((row) => {
    counts[row.mission_key] = (counts[row.mission_key] ?? 0) + 1;
  });
  return counts;
}

export async function getWeeklyMissionCompletionCounts(userId: string): Promise<MissionCompletionCounts> {
  const { data, error } = await supabase.from('weekly_missions').select('mission_key').eq('user_id', userId);
  if (error) throw error;

  const counts: MissionCompletionCounts = {};
  (data ?? []).forEach((row) => {
    counts[row.mission_key] = (counts[row.mission_key] ?? 0) + 1;
  });
  return counts;
}

// ---------------------------------------------------------------------------
// Misiones de Operador y Psicológicas — mismo mecanismo anti-trampa que las
// misiones diarias: se verifican solas contra respuestas reales del quiz,
// operaciones y la Ataraxia ya calculada, nunca por autoreporte.
// ---------------------------------------------------------------------------

export const OPERATOR_PSYCH_MISSION_KEYS = {
  ANALYSIS_CORRECT: 'ANALYSIS_CORRECT',
  RISK_MANAGEMENT_MISSION: 'RISK_MANAGEMENT_MISSION',
  RESPECT_ANALYSIS: 'RESPECT_ANALYSIS',
  NO_NEGATIVE_EMOTIONS: 'NO_NEGATIVE_EMOTIONS',
  DISCIPLINE_85: 'DISCIPLINE_85',
} as const;

const SETUP_MISSION_KEY_PREFIX = 'setup:';

/**
 * Análisis correcto / manejo de riesgo / respeto al análisis / sin emociones
 * negativas / disciplina — las 5 son "una vez por día" como las 4 misiones
 * diarias originales, así que reutilizan el mismo upsert+ignoreDuplicates.
 */
export async function logOperatorAndPsychMissionCompletions(
  userId: string,
  input: { entryDate: string; entry: JournalEntryFull; ataraxiaScore: number | null },
): Promise<void> {
  const quiz = input.entry.custom_fields.quiz;
  const keys: string[] = [];

  if (quiz.bias_correct?.answer === 'Sí') keys.push(OPERATOR_PSYCH_MISSION_KEYS.ANALYSIS_CORRECT);
  if (quiz.risk_respected?.answer === 'Sí') keys.push(OPERATOR_PSYCH_MISSION_KEYS.RISK_MANAGEMENT_MISSION);
  if (quiz.narrative_respected?.answer === 'Sí') keys.push(OPERATOR_PSYCH_MISSION_KEYS.RESPECT_ANALYSIS);
  if (hasOnlyConstructiveEmotions(input.entry.custom_fields.psychology_emotions)) {
    keys.push(OPERATOR_PSYCH_MISSION_KEYS.NO_NEGATIVE_EMOTIONS);
  }
  if (input.ataraxiaScore !== null && input.ataraxiaScore >= 85) {
    keys.push(OPERATOR_PSYCH_MISSION_KEYS.DISCIPLINE_85);
  }

  if (keys.length === 0) return;

  const rows = keys.map((key) => ({ user_id: userId, mission_key: key, entry_date: input.entryDate }));
  const { error } = await supabase
    .from('core_mission_completions')
    .upsert(rows, { onConflict: 'user_id,mission_key,entry_date', ignoreDuplicates: true });
  if (error) throw error;
}

/**
 * Medallas de setup — a diferencia de las de arriba, un setup puede
 * ejecutarse VARIAS veces el mismo día, así que en vez de upsert-e-ignorar
 * se REEMPLAZA por completo el conteo del día (borra + inserta), igual que
 * `replaceOperations`/`replaceVirtusEvents`. Esto evita depender del id de
 * cada operación (que cambia en cada re-sello, ver `replaceOperations`) y
 * hace que editar el día corrija el conteo en vez de duplicarlo o perderlo.
 * "Válido" = se ejecutó de verdad (`quality` no nulo ni "No ejecuté") y no
 * rompió el plan — nunca mira el P&L.
 */
export async function replaceSetupMissionCompletions(
  userId: string,
  entryDate: string,
  operations: OperationItem[],
  setups: SetupItem[],
): Promise<void> {
  const { error: deleteError } = await supabase
    .from('core_mission_completions')
    .delete()
    .eq('user_id', userId)
    .eq('entry_date', entryDate)
    .like('mission_key', `${SETUP_MISSION_KEY_PREFIX}%`);
  if (deleteError) throw deleteError;

  const rows = operations
    .filter((op) => op.quality !== null && op.quality !== 'No ejecuté' && !op.brokePlan && op.model)
    .map((op) => setups.find((setup) => setup.name === op.model))
    .filter((setup): setup is SetupItem => Boolean(setup))
    .map((setup) => ({ user_id: userId, mission_key: `${SETUP_MISSION_KEY_PREFIX}${setup.id}`, entry_date: entryDate }));

  if (rows.length === 0) return;

  const { error: insertError } = await supabase.from('core_mission_completions').insert(rows);
  if (insertError) throw insertError;
}

export type PsychGrowthCategory = 'correccion' | 'fortaleza';

export async function getPsychGrowthCounts(userId: string): Promise<Record<PsychGrowthCategory, number>> {
  const { data, error } = await supabase.from('psychological_growth_events').select('category').eq('user_id', userId);
  if (error) throw error;

  const counts: Record<PsychGrowthCategory, number> = { correccion: 0, fortaleza: 0 };
  (data ?? []).forEach((row) => {
    const category = row.category as PsychGrowthCategory;
    counts[category] = (counts[category] ?? 0) + 1;
  });
  return counts;
}

// ---------------------------------------------------------------------------
// Misiones semanales — Módulo 5A
// ---------------------------------------------------------------------------

export type WeeklyMissionsStatus = {
  daysWithEntry: number;
  cleanWeek: boolean;
};

export function getWeekBounds(referenceDate: Date): { weekStart: string; weekEnd: string } {
  const mondayOffset = (referenceDate.getDay() + 6) % 7;
  const monday = new Date(referenceDate);
  monday.setDate(referenceDate.getDate() - mondayOffset);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return { weekStart: localIsoDate(monday), weekEnd: localIsoDate(sunday) };
}

export type WeeklyKillSwitchStatus = {
  redDays: number;
  greenDays: number;
  triggered: 'red_limit' | 'euphoria' | null;
  weekStart: string;
  weekEnd: string;
};

const RED_DAY_LIMIT = 3;
const GREEN_DAY_LIMIT = 4;

/**
 * Kill-switch semanal — se recalcula en vivo desde journal_entries/operations
 * reales cada vez que se llama, nunca se guarda como un flag. Eso es lo que
 * lo hace imposible de saltarse con un F5 y lo que lo resetea solo el lunes:
 * no hay nada que "expire", la semana simplemente cambia.
 */
export async function getWeeklyKillSwitchStatus(
  userId: string,
  referenceDate: Date,
): Promise<WeeklyKillSwitchStatus> {
  const { weekStart, weekEnd } = getWeekBounds(referenceDate);
  const ops = await getOperationsInRange(userId, weekStart, weekEnd);
  const summaryByDate = summarizeOperationsByDate(ops);

  let redDays = 0;
  let greenDays = 0;
  Object.entries(summaryByDate).forEach(([date, summary]) => {
    const day = new Date(`${date}T12:00:00`);
    const isWeekday = day.getDay() >= 1 && day.getDay() <= 5;
    if (!isWeekday || !summary.hasPnl) return;
    if (summary.pnl < 0) redDays += 1;
    else if (summary.pnl > 0) greenDays += 1;
  });

  const triggered = redDays >= RED_DAY_LIMIT ? 'red_limit' : greenDays >= GREEN_DAY_LIMIT ? 'euphoria' : null;
  return { redDays, greenDays, triggered, weekStart, weekEnd };
}

export async function getWeeklyMissionsStatus(
  userId: string,
  weekStart: string,
  weekEnd: string,
): Promise<WeeklyMissionsStatus> {
  const [{ data: entries, error: entriesError }, { data: ops, error: opsError }] = await Promise.all([
    supabase
      .from('journal_entries')
      .select('entry_date, followed_scenario')
      .eq('user_id', userId)
      .gte('entry_date', weekStart)
      .lte('entry_date', weekEnd),
    supabase
      .from('operations')
      .select('broke_plan')
      .eq('user_id', userId)
      .gte('entry_date', weekStart)
      .lte('entry_date', weekEnd),
  ]);

  if (entriesError) throw entriesError;
  if (opsError) throw opsError;

  const daysWithEntry = new Set((entries ?? []).map((row) => row.entry_date)).size;
  const brokePlan =
    (entries ?? []).some((row) => row.followed_scenario === false) || (ops ?? []).some((row) => row.broke_plan);

  return { daysWithEntry, cleanWeek: daysWithEntry > 0 && !brokePlan };
}

export type WeeklyMissionDefinition = {
  key: string;
  label: string;
  difficulty: 'FÁCIL' | 'MEDIA' | 'DIFÍCIL';
  points: number;
  isDone: (status: WeeklyMissionsStatus) => boolean;
};

export const weeklyMissionDefinitions: WeeklyMissionDefinition[] = [
  {
    key: 'WEEKLY_CLEAN_WEEK',
    label: 'Cierra la semana sin romper tu plan',
    difficulty: 'MEDIA',
    points: 30,
    isDone: (status) => status.cleanWeek,
  },
  {
    key: 'WEEKLY_FULL_WEEK',
    label: 'Completa tu journal 5 días esta semana',
    difficulty: 'DIFÍCIL',
    points: 50,
    isDone: (status) => status.daysWithEntry >= 5,
  },
];

export async function awardWeeklyMissions(
  userId: string,
  weekStart: string,
  status: WeeklyMissionsStatus,
): Promise<void> {
  const earned = weeklyMissionDefinitions.filter((mission) => mission.isDone(status));
  if (earned.length === 0) return;

  const rows = earned.map((mission) => ({
    user_id: userId,
    week_start: weekStart,
    mission_key: mission.key,
    points: mission.points,
  }));

  const { error } = await supabase
    .from('weekly_missions')
    .upsert(rows, { onConflict: 'user_id,week_start,mission_key', ignoreDuplicates: true });

  if (error) throw error;
}

export async function getCompletedWeeklyMissionKeys(userId: string, weekStart: string): Promise<Set<string>> {
  const { data, error } = await supabase
    .from('weekly_missions')
    .select('mission_key')
    .eq('user_id', userId)
    .eq('week_start', weekStart);

  if (error) throw error;
  return new Set((data ?? []).map((row) => row.mission_key));
}

// ---------------------------------------------------------------------------
// Misiones de Omega — 100% solo lectura desde el cliente. Las inserciones Y
// el progreso los escribe exclusivamente la Edge Function omega-coach con la
// Service Role Key (tool `update_mission_progress`) — el trader no tiene
// ninguna vía para marcar su propia misión como completada; es Omega quien
// verifica la evidencia real de la sesión antes de mover progress_pct.
// ---------------------------------------------------------------------------

export type AiMissionFrequency = 'diaria' | 'semanal' | 'unica';

export type AiMission = {
  id: string;
  title: string;
  description: string;
  reward_xp: number;
  completed: boolean;
  progress_pct: number;
  frequency: AiMissionFrequency;
  created_at: string;
};

export async function getAiMissions(userId: string): Promise<AiMission[]> {
  const { data, error } = await supabase
    .from('ai_missions')
    .select('id, title, description, reward_xp, completed, progress_pct, frequency, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []) as AiMission[];
}

/** Fecha (YYYY-MM-DD) del journal más reciente del usuario, sellado o no. */
export async function getLatestJournalEntryDate(userId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('journal_entries')
    .select('entry_date')
    .eq('user_id', userId)
    .order('entry_date', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data?.entry_date ?? null;
}

export type OmegaAuditRow = {
  id: string;
  audit_date: string;
  game_state: 'A' | 'B' | 'C';
  daily_feedback: string;
  strengths: { behavior: string; hypothesis: string; fix: string }[];
  weaknesses: { behavior: string; hypothesis: string; fix: string }[];
  daily_missions: { id: number; task: string; xpReward: number }[];
  manual_audit: { issue_detected: string; suggested_rule: string };
  created_at: string;
};

/** Auditoría del Head Coach ya guardada para hoy, si existe (una por día — ver unique(user_id, audit_date)). */
export async function getTodayOmegaAudit(userId: string, todayIso: string): Promise<OmegaAuditRow | null> {
  const { data, error } = await supabase
    .from('omega_audits')
    .select('id, audit_date, game_state, daily_feedback, strengths, weaknesses, daily_missions, manual_audit, created_at')
    .eq('user_id', userId)
    .eq('audit_date', todayIso)
    .maybeSingle();

  if (error) throw error;
  return data as OmegaAuditRow | null;
}

export type AiSessionVerdict = {
  id: string;
  session_date: string;
  ataraxia_score: number | null;
  verdict: string;
  went_well: string[];
  went_wrong: string[];
  created_at: string;
};

export async function getLatestSessionVerdict(userId: string): Promise<AiSessionVerdict | null> {
  const { data, error } = await supabase
    .from('ai_session_verdicts')
    .select('id, session_date, ataraxia_score, verdict, went_well, went_wrong, created_at')
    .eq('user_id', userId)
    .order('session_date', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data as AiSessionVerdict | null;
}

/**
 * Última razón que Omega dio para cada meta automática que ajustó — trae las
 * filas recientes y se queda con la más nueva por goal_id (reducido en
 * cliente; el volumen por trader es bajo, no amerita una función de Postgres
 * solo para esto).
 */
export async function getLatestGoalProgressReasons(
  userId: string,
): Promise<Map<string, { reason: string; delta: number; createdAt: string }>> {
  const { data, error } = await supabase
    .from('goal_progress_events')
    .select('goal_id, reason, delta, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) throw error;

  const byGoal = new Map<string, { reason: string; delta: number; createdAt: string }>();
  (data ?? []).forEach((row) => {
    if (!byGoal.has(row.goal_id)) {
      byGoal.set(row.goal_id, { reason: row.reason, delta: row.delta, createdAt: row.created_at });
    }
  });
  return byGoal;
}

/**
 * Counts consecutive days with a journal entry, walking backward from
 * referenceDate until the first missing day.
 */
/**
 * Counts consecutive TRADING days with a journal entry, walking backward from
 * referenceDate. Weekends (Sat/Sun) with no entry don't break the streak —
 * there's nothing to trade — unless tradesCrypto is true, since crypto markets
 * run 24/7 and every day counts.
 */
export async function getStreak(
  userId: string,
  referenceDate: string,
  tradesCrypto: boolean,
  maxLookback = 120,
): Promise<number> {
  const since = new Date(`${referenceDate}T00:00:00`);
  since.setDate(since.getDate() - maxLookback);

  const { data, error } = await supabase
    .from('journal_entries')
    .select('entry_date')
    .eq('user_id', userId)
    .gte('entry_date', localIsoDate(since))
    .lte('entry_date', referenceDate);

  if (error) throw error;

  const dates = new Set((data ?? []).map((row) => row.entry_date));
  let streak = 0;
  const cursor = new Date(`${referenceDate}T00:00:00`);

  for (let i = 0; i < maxLookback; i += 1) {
    const key = localIsoDate(cursor);
    const isWeekend = cursor.getDay() === 0 || cursor.getDay() === 6;

    if (dates.has(key)) {
      streak += 1;
    } else if (tradesCrypto || !isWeekend) {
      break;
    }

    cursor.setDate(cursor.getDate() - 1);
  }

  return streak;
}

export type StatsRange = 'day' | 'week' | 'month' | 'year' | 'all';

export type StatsPreview = {
  operationsCount: number;
  winRatePct: number | null;
  pnl: number;
};

export async function getStatsPreview(userId: string, range: StatsRange = 'week'): Promise<StatsPreview> {
  const { data, error } = await supabase.from('operations').select('pnl, entry_date').eq('user_id', userId);

  if (error) throw error;

  const rows = data ?? [];
  const todayIso = localIsoDate(new Date());

  const withinRange = (entryDate: string): boolean => {
    if (range === 'all') return true;
    if (range === 'day') return entryDate === todayIso;
    const since = new Date();
    if (range === 'week') since.setDate(since.getDate() - 7);
    else if (range === 'month') since.setDate(since.getDate() - 30);
    else since.setDate(since.getDate() - 365);
    return entryDate >= localIsoDate(since);
  };

  const scoped = rows.filter((row) => withinRange(row.entry_date));
  const scored = scoped.filter((row) => row.pnl !== null);
  const wins = scored.filter((row) => (row.pnl as number) > 0).length;
  const winRatePct = scored.length === 0 ? null : Math.round((wins / scored.length) * 100);
  const pnl = scored.reduce((sum, row) => sum + (row.pnl as number), 0);

  return { operationsCount: scoped.length, winRatePct, pnl };
}

export async function getPendingFriendRequestsCount(userId: string): Promise<number> {
  const { count, error } = await supabase
    .from('friend_requests')
    .select('id', { count: 'exact', head: true })
    .eq('to_user', userId)
    .eq('status', 'pending');

  if (error) throw error;
  return count ?? 0;
}

export type SharedEntry = {
  id: string;
  fromUserId: string;
  fromLabel: string;
  entryDate: string;
  journalEntryId: string;
  createdAt: string;
};

export async function getRecentSharesForMe(userId: string, limit = 4): Promise<SharedEntry[]> {
  const { data, error } = await supabase
    .from('journal_shares')
    .select('id, from_user, journal_entry_id, created_at, journal_entries(entry_date)')
    .eq('to_user', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;

  const rows = (data ?? []) as unknown as Array<{
    id: string;
    from_user: string;
    journal_entry_id: string;
    created_at: string;
    journal_entries: { entry_date: string } | null;
  }>;

  const fromIds = [...new Set(rows.map((row) => row.from_user))];
  if (fromIds.length === 0) return [];

  const { data: profiles, error: profileError } = await supabase
    .from('profiles')
    .select('id, email, display_name')
    .in('id', fromIds);
  if (profileError) throw profileError;

  const labelById = new Map((profiles ?? []).map((profile) => [profile.id, profile.display_name || profile.email]));

  return rows.map((row) => ({
    id: row.id,
    fromUserId: row.from_user,
    fromLabel: labelById.get(row.from_user) ?? 'Alguien',
    entryDate: row.journal_entries?.entry_date ?? '',
    journalEntryId: row.journal_entry_id,
    createdAt: row.created_at,
  }));
}

// ---------------------------------------------------------------------------
// Historial + Estadísticas — Fase 4
// ---------------------------------------------------------------------------

export type OperationRecord = {
  id: string;
  entry_date: string;
  symbol: string;
  direction: Direction;
  model: string | null;
  quality: OperationQuality | null;
  session: ExecutionWindow | null;
  pnl: number | null;
  outcome: OperationOutcome | null;
  broke_plan: boolean;
};

export async function getOperationsInRange(
  userId: string,
  startDate: string,
  endDate: string,
): Promise<OperationRecord[]> {
  const { data, error } = await supabase
    .from('operations')
    .select('id, entry_date, symbol, direction, model, quality, session, pnl, outcome, broke_plan')
    .eq('user_id', userId)
    .gte('entry_date', startDate)
    .lte('entry_date', endDate)
    .order('entry_date', { ascending: true });

  if (error) throw error;
  return (data ?? []) as OperationRecord[];
}

export async function getMacroNewsFlagsByDate(userId: string): Promise<Record<string, boolean>> {
  const { data, error } = await supabase
    .from('journal_entries')
    .select('entry_date, custom_fields')
    .eq('user_id', userId);

  if (error) throw error;

  const map: Record<string, boolean> = {};
  (data ?? []).forEach((row) => {
    const flag = (row.custom_fields as { had_macro_news?: unknown } | null)?.had_macro_news;
    if (typeof flag === 'boolean') {
      map[row.entry_date] = flag;
    }
  });
  return map;
}

export async function getAllOperations(userId: string, limit = 2000): Promise<OperationRecord[]> {
  const { data, error } = await supabase
    .from('operations')
    .select('id, entry_date, symbol, direction, model, quality, session, pnl, outcome, broke_plan')
    .eq('user_id', userId)
    .order('entry_date', { ascending: true })
    .limit(limit);

  if (error) throw error;
  return (data ?? []) as OperationRecord[];
}

export type DisciplineDailyInput = {
  directriz: string | null;
  quiz: QuizState;
  psychologyEmotions: string[];
};

// Bulk fetch for the Arete (discipline) index history — reuses the same
// journal_entries columns already fetched per-day elsewhere, just across all
// dates at once so Estadísticas/Dashboard can compute trends without N+1s.
export async function getDisciplineInputsByDate(userId: string): Promise<Record<string, DisciplineDailyInput>> {
  const { data, error } = await supabase
    .from('journal_entries')
    .select('entry_date, directriz, custom_fields')
    .eq('user_id', userId);

  if (error) throw error;

  const map: Record<string, DisciplineDailyInput> = {};
  (data ?? []).forEach((row) => {
    const customFields = row.custom_fields as
      | { quiz?: unknown; psychology_emotions?: unknown }
      | null;
    map[row.entry_date] = {
      directriz: row.directriz,
      quiz: normalizeQuizState(customFields?.quiz),
      psychologyEmotions: Array.isArray(customFields?.psychology_emotions)
        ? (customFields.psychology_emotions as string[])
        : [],
    };
  });
  return map;
}

// ---------------------------------------------------------------------------
// Social — Fase 5
// ---------------------------------------------------------------------------

export type ProfileMatch = { id: string; email: string; label: string };

export async function searchProfileByEmail(email: string): Promise<ProfileMatch | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, display_name')
    .ilike('email', email.trim())
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;
  return { id: data.id, email: data.email, label: data.display_name || data.email };
}

export type FriendRequestStatus = 'pending' | 'accepted' | 'rejected';

export async function getFriendRequestBetween(
  userA: string,
  userB: string,
): Promise<{ id: string; status: FriendRequestStatus } | null> {
  const { data, error } = await supabase
    .from('friend_requests')
    .select('id, status')
    .or(`and(from_user.eq.${userA},to_user.eq.${userB}),and(from_user.eq.${userB},to_user.eq.${userA})`)
    .maybeSingle();

  if (error) throw error;
  return data as { id: string; status: FriendRequestStatus } | null;
}

export async function sendFriendRequest(fromUser: string, toUser: string): Promise<void> {
  const { error } = await supabase
    .from('friend_requests')
    .insert({ from_user: fromUser, to_user: toUser, status: 'pending' });

  if (error) throw error;
}

export type PendingFriendRequest = {
  id: string;
  fromUserId: string;
  label: string;
  createdAt: string;
};

export async function getPendingFriendRequests(userId: string): Promise<PendingFriendRequest[]> {
  const { data, error } = await supabase
    .from('friend_requests')
    .select('id, from_user, created_at')
    .eq('to_user', userId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });

  if (error) throw error;

  const rows = data ?? [];
  const fromIds = [...new Set(rows.map((row) => row.from_user))];
  if (fromIds.length === 0) return [];

  const { data: profiles, error: profileError } = await supabase
    .from('profiles')
    .select('id, email, display_name')
    .in('id', fromIds);
  if (profileError) throw profileError;

  const labelById = new Map((profiles ?? []).map((profile) => [profile.id, profile.display_name || profile.email]));

  return rows.map((row) => ({
    id: row.id,
    fromUserId: row.from_user,
    label: labelById.get(row.from_user) ?? 'Alguien',
    createdAt: row.created_at,
  }));
}

export async function respondToFriendRequest(requestId: string, accept: boolean): Promise<void> {
  const { error } = await supabase
    .from('friend_requests')
    .update({ status: accept ? 'accepted' : 'rejected', responded_at: new Date().toISOString() })
    .eq('id', requestId);

  if (error) throw error;
}

/**
 * Calls a SECURITY DEFINER function that checks friendship server-side and
 * returns only the derived Virtus stage (LOGOS/ETHOS/...) — never the raw
 * point total or event history.
 */
export async function getFriendVirtusStage(targetUserId: string): Promise<string | null> {
  const { data, error } = await supabase.rpc('get_friend_virtus_stage', { target_user: targetUserId });
  if (error) throw error;
  return (data as string | null) ?? null;
}

export async function getProfileLabel(userId: string): Promise<string> {
  const { data, error } = await supabase.from('profiles').select('email, display_name').eq('id', userId).maybeSingle();
  if (error) throw error;
  return data?.display_name || data?.email || 'Alguien';
}

/**
 * Reads a journal entry by id regardless of date — RLS restricts this to the
 * caller's own entries or entries explicitly shared with them.
 */
export async function getJournalEntryById(entryId: string): Promise<(JournalEntryFull & { userId: string }) | null> {
  const { data, error } = await supabase
    .from('journal_entries')
    .select(
      'id, user_id, entry_date, emotional_state, directriz, market_context, top_down, custom_fields, screenshots, post_market_analysis, scenario_id, followed_scenario, discipline_break_reason, discipline_break_note',
    )
    .eq('id', entryId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const topDown = data.top_down as Partial<TopDownData> | null;

  return {
    id: data.id,
    userId: data.user_id,
    entry_date: data.entry_date,
    emotional_state: data.emotional_state as EmotionalState | null,
    directriz: data.directriz,
    market_context: data.market_context,
    top_down: {
      htf: { ...emptyTopDown().htf, ...(topDown?.htf ?? {}) },
      ltf: { ...emptyTopDown().ltf, ...(topDown?.ltf ?? {}) },
    },
    custom_fields: {
      dol_target: data.custom_fields?.dol_target ?? '',
      dol_invalidation: data.custom_fields?.dol_invalidation ?? '',
      risk_within_plan: data.custom_fields?.risk_within_plan ?? null,
      took_trade: data.custom_fields?.took_trade ?? null,
      quiz: normalizeQuizState(data.custom_fields?.quiz),
      quiz_extra_notes: data.custom_fields?.quiz_extra_notes ?? '',
      psychology_emotions: Array.isArray(data.custom_fields?.psychology_emotions)
        ? (data.custom_fields.psychology_emotions as string[])
        : [],
      had_macro_news: data.custom_fields?.had_macro_news ?? null,
      macro_news: data.custom_fields?.macro_news ?? null,
      phase1_sealed_at: data.custom_fields?.phase1_sealed_at ?? null,
      phase2_sealed_at: data.custom_fields?.phase2_sealed_at ?? null,
      sealed_at: data.custom_fields?.sealed_at ?? null,
    },
    screenshots: (data.screenshots ?? []) as ScreenshotItem[],
    post_market_analysis: data.post_market_analysis,
    scenario_id: data.scenario_id,
    followed_scenario: data.followed_scenario,
    discipline_break_reason: data.discipline_break_reason as DisciplineBreakReason | null,
    discipline_break_note: data.discipline_break_note,
  };
}

export type FeedbackItem = {
  id: string;
  authorLabel: string;
  message: string;
  createdAt: string;
};

export async function getEntryFeedback(journalEntryId: string): Promise<FeedbackItem[]> {
  const { data, error } = await supabase
    .from('entry_feedback')
    .select('id, author_id, message, created_at')
    .eq('journal_entry_id', journalEntryId)
    .order('created_at', { ascending: true });

  if (error) throw error;

  const rows = data ?? [];
  const authorIds = [...new Set(rows.map((row) => row.author_id))];
  if (authorIds.length === 0) return [];

  const { data: profiles, error: profileError } = await supabase
    .from('profiles')
    .select('id, email, display_name')
    .in('id', authorIds);
  if (profileError) throw profileError;

  const labelById = new Map((profiles ?? []).map((profile) => [profile.id, profile.display_name || profile.email]));

  return rows.map((row) => ({
    id: row.id,
    authorLabel: labelById.get(row.author_id) ?? 'Alguien',
    message: row.message,
    createdAt: row.created_at,
  }));
}

export async function addEntryFeedback(journalEntryId: string, authorId: string, message: string): Promise<void> {
  const { error } = await supabase
    .from('entry_feedback')
    .insert({ journal_entry_id: journalEntryId, author_id: authorId, message });

  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Gestor de Cuentas de Fondeo — Conexiones
// ---------------------------------------------------------------------------

export type FundingAccountType = 'EVAL' | 'PA';
export type FundingAccountStatus = 'active' | 'breached' | 'passed' | 'inactive';
export type FundingDrawdownType = 'EOD' | 'TRAILING' | 'DAILY';

export type FundingAccount = {
  id: string;
  accountName: string;
  accountType: FundingAccountType;
  accountNumber: string | null;
  status: FundingAccountStatus;
  drawdownType: FundingDrawdownType;
  startingBalance: number;
  currentBalance: number;
  profitTarget: number;
  drawdownLimit: number;
  dailyLossLimit: number | null;
  tradingDays: number;
  createdAt: string;
};

const FUNDING_ACCOUNT_COLUMNS =
  'id, account_name, account_type, account_number, status, drawdown_type, starting_balance, current_balance, profit_target, drawdown_limit, daily_loss_limit, created_at';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapFundingAccountRow(row: any, tradingDays: number): FundingAccount {
  return {
    id: row.id,
    accountName: row.account_name,
    accountType: row.account_type,
    accountNumber: row.account_number,
    status: row.status,
    drawdownType: row.drawdown_type,
    startingBalance: row.starting_balance,
    currentBalance: row.current_balance,
    profitTarget: row.profit_target,
    drawdownLimit: row.drawdown_limit,
    dailyLossLimit: row.daily_loss_limit,
    tradingDays,
    createdAt: row.created_at,
  };
}

/**
 * Trading Days no es una columna — se cuenta en vivo desde
 * journal_funding_accounts + journal_entries (días de journal distintos
 * asociados a cada cuenta), para que nunca se desincronice de la realidad.
 */
export async function getFundingAccounts(userId: string): Promise<FundingAccount[]> {
  const [{ data, error }, { data: links, error: linksError }] = await Promise.all([
    supabase.from('funding_accounts').select(FUNDING_ACCOUNT_COLUMNS).eq('user_id', userId).order('created_at', { ascending: false }),
    supabase
      .from('journal_funding_accounts')
      .select('funding_account_id, journal_entries(entry_date)')
      .eq('user_id', userId),
  ]);

  if (error) throw error;
  if (linksError) throw linksError;

  const datesByAccount = new Map<string, Set<string>>();
  (links ?? []).forEach((link) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const entryDate = (link as any).journal_entries?.entry_date;
    if (!entryDate) return;
    const set = datesByAccount.get(link.funding_account_id) ?? new Set<string>();
    set.add(entryDate);
    datesByAccount.set(link.funding_account_id, set);
  });

  return (data ?? []).map((row) => mapFundingAccountRow(row, datesByAccount.get(row.id)?.size ?? 0));
}

export async function createFundingAccount(
  userId: string,
  input: {
    accountName: string;
    accountType: FundingAccountType;
    accountNumber: string | null;
    drawdownType: FundingDrawdownType;
    startingBalance: number;
    profitTarget: number;
    drawdownLimit: number;
    dailyLossLimit: number | null;
  },
): Promise<FundingAccount> {
  const { data, error } = await supabase
    .from('funding_accounts')
    .insert({
      user_id: userId,
      account_name: input.accountName,
      account_type: input.accountType,
      account_number: input.accountNumber,
      drawdown_type: input.drawdownType,
      starting_balance: input.startingBalance,
      current_balance: input.startingBalance,
      profit_target: input.profitTarget,
      drawdown_limit: input.drawdownLimit,
      daily_loss_limit: input.dailyLossLimit,
    })
    .select(FUNDING_ACCOUNT_COLUMNS)
    .single();

  if (error) throw error;
  return mapFundingAccountRow(data, 0);
}

export async function updateFundingAccountBalance(accountId: string, newBalance: number): Promise<void> {
  const { error } = await supabase
    .from('funding_accounts')
    .update({ current_balance: newBalance, updated_at: new Date().toISOString() })
    .eq('id', accountId);

  if (error) throw error;
}

export async function updateFundingAccountStatus(accountId: string, status: FundingAccountStatus): Promise<void> {
  const { error } = await supabase
    .from('funding_accounts')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', accountId);

  if (error) throw error;
}

export async function deleteFundingAccount(accountId: string): Promise<void> {
  const { error } = await supabase.from('funding_accounts').delete().eq('id', accountId);
  if (error) throw error;
}

export type FundingAccountsSummary = {
  used: number;
  passed: number;
  breached: number;
  active: number;
  inactive: number;
};

export async function getFundingAccountsSummary(userId: string): Promise<FundingAccountsSummary> {
  const { data, error } = await supabase.from('funding_accounts').select('status').eq('user_id', userId);
  if (error) throw error;

  const rows = data ?? [];
  return {
    used: rows.length,
    passed: rows.filter((row) => row.status === 'passed').length,
    breached: rows.filter((row) => row.status === 'breached').length,
    active: rows.filter((row) => row.status === 'active').length,
    inactive: rows.filter((row) => row.status === 'inactive').length,
  };
}

export type FundingPayout = {
  id: string;
  accountId: string | null;
  accountName: string | null;
  amount: number;
  payoutDate: string;
  createdAt: string;
};

export async function getFundingPayouts(userId: string): Promise<FundingPayout[]> {
  const { data, error } = await supabase
    .from('funding_payouts')
    .select('id, funding_account_id, amount, payout_date, created_at, funding_accounts(account_name)')
    .eq('user_id', userId)
    .order('payout_date', { ascending: false });

  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id,
    accountId: row.funding_account_id,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    accountName: (row as any).funding_accounts?.account_name ?? null,
    amount: row.amount,
    payoutDate: row.payout_date,
    createdAt: row.created_at,
  }));
}

export async function createFundingPayout(
  userId: string,
  input: { accountId: string | null; amount: number; payoutDate: string },
): Promise<void> {
  const { error } = await supabase.from('funding_payouts').insert({
    user_id: userId,
    funding_account_id: input.accountId,
    amount: input.amount,
    payout_date: input.payoutDate,
  });
  if (error) throw error;
}

/** Ids de las cuentas de fondeo ya asociadas a un journal (para precargar los checkboxes al reabrir la Fase 2). */
export async function getJournalFundingAccountIds(journalEntryId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('journal_funding_accounts')
    .select('funding_account_id')
    .eq('journal_entry_id', journalEntryId);

  if (error) throw error;
  return (data ?? []).map((row) => row.funding_account_id);
}

/** Cuentas de fondeo reales asociadas a un journal — para el candado de riesgo de Omega. */
export async function getFundingAccountsForJournalEntry(journalEntryId: string): Promise<FundingAccount[]> {
  const { data, error } = await supabase
    .from('journal_funding_accounts')
    .select(`funding_accounts (${FUNDING_ACCOUNT_COLUMNS})`)
    .eq('journal_entry_id', journalEntryId);

  if (error) throw error;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).filter((row: any) => row.funding_accounts).map((row: any) => mapFundingAccountRow(row.funding_accounts, 0));
}

/** Reemplaza las cuentas asociadas a un journal — mismo patrón delete+insert que replaceOperations. */
export async function replaceJournalFundingAccounts(
  userId: string,
  journalEntryId: string,
  accountIds: string[],
): Promise<void> {
  const { error: deleteError } = await supabase
    .from('journal_funding_accounts')
    .delete()
    .eq('journal_entry_id', journalEntryId);
  if (deleteError) throw deleteError;

  if (accountIds.length === 0) return;

  const { error: insertError } = await supabase.from('journal_funding_accounts').insert(
    accountIds.map((accountId) => ({
      user_id: userId,
      journal_entry_id: journalEntryId,
      funding_account_id: accountId,
    })),
  );
  if (insertError) throw insertError;
}

// ---------------------------------------------------------------------------
// Recap Semanal — Omega Coach
// ---------------------------------------------------------------------------

export type WeeklyOmegaAuditSummary = {
  gameState: 'A' | 'B' | 'C';
  strengths: { behavior: string; hypothesis: string; fix: string }[];
  weaknesses: { behavior: string; hypothesis: string; fix: string }[];
};

/** Auditorías del Head Coach de la semana — de ahí sale la distribución de Juego A/B/C y las fugas repetidas. */
export async function getOmegaAuditsForWeek(
  userId: string,
  weekStart: string,
  weekEnd: string,
): Promise<WeeklyOmegaAuditSummary[]> {
  const { data, error } = await supabase
    .from('omega_audits')
    .select('game_state, strengths, weaknesses')
    .eq('user_id', userId)
    .gte('audit_date', weekStart)
    .lte('audit_date', weekEnd);

  if (error) throw error;
  return (data ?? []).map((row) => ({
    gameState: row.game_state,
    strengths: row.strengths ?? [],
    weaknesses: row.weaknesses ?? [],
  }));
}

export type WeeklyVirtusAiEvent = { points: number; reason: string };

/** Eventos reales de XP (con timestamp real) de la semana — de ahí salen misiones completadas + XP ganada. */
export async function getVirtusAiEventsForWeek(
  userId: string,
  weekStart: string,
  weekEnd: string,
): Promise<WeeklyVirtusAiEvent[]> {
  const dayAfterWeekEnd = localIsoDate(new Date(new Date(`${weekEnd}T00:00:00`).getTime() + 24 * 60 * 60 * 1000));
  const { data, error } = await supabase
    .from('virtus_ai_events')
    .select('points, reason')
    .eq('user_id', userId)
    .gte('created_at', `${weekStart}T00:00:00`)
    .lt('created_at', `${dayAfterWeekEnd}T00:00:00`);

  if (error) throw error;
  return (data ?? []) as WeeklyVirtusAiEvent[];
}

// --- Omega Coach: briefings persistidos (omega_briefings) ---

export async function getTodayBriefingAckStatus(
  userId: string,
  date: string,
): Promise<{ exists: boolean; acknowledged: boolean }> {
  const { data, error } = await supabase
    .from('omega_briefings')
    .select('acknowledged_at')
    .eq('user_id', userId)
    .eq('briefing_date', date)
    .maybeSingle();

  if (error) throw error;
  if (!data) return { exists: false, acknowledged: false };
  return { exists: true, acknowledged: data.acknowledged_at !== null };
}

/** "Contrato de lectura" — el propio trader marca que leyó el briefing de hoy. Sin XP asociado, RLS lo permite. */
export async function acknowledgeBriefing(userId: string, date: string): Promise<void> {
  const { error } = await supabase
    .from('omega_briefings')
    .update({ acknowledged_at: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('briefing_date', date);

  if (error) throw error;
}

/** Fechas (YYYY-MM-DD) con briefing guardado dentro del rango — para pintar el punto dorado del calendario histórico. */
export async function getBriefingDatesInRange(userId: string, start: string, end: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('omega_briefings')
    .select('briefing_date')
    .eq('user_id', userId)
    .gte('briefing_date', start)
    .lte('briefing_date', end);

  if (error) throw error;
  return (data ?? []).map((row) => row.briefing_date as string);
}

export async function getBriefingByDate(userId: string, date: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('omega_briefings')
    .select('content')
    .eq('user_id', userId)
    .eq('briefing_date', date)
    .maybeSingle();

  if (error) throw error;
  return data?.content ?? null;
}

export type VirtusEventReason = { reason: string; points: number };

/**
 * Eventos reales de Virtus de HOY (deterministas del sello del día +
 * ai_events de Omega), separados por signo — "Qué sumó" / "Qué restó" del
 * Tab Estado. Distinto de la caja de feedback de texto libre del Tab
 * Conversación: acá son los eventos puntuales con su puntaje real.
 */
export async function getTodayVirtusEventReasons(
  userId: string,
  date: string,
): Promise<{ positive: VirtusEventReason[]; negative: VirtusEventReason[] }> {
  const entry = await getJournalEntryByDate(userId, date);
  const nextDay = localIsoDate(new Date(new Date(`${date}T00:00:00`).getTime() + 24 * 60 * 60 * 1000));

  const [sealedEvents, aiEvents] = await Promise.all([
    entry?.id
      ? supabase.from('virtus_events').select('label, points').eq('journal_entry_id', entry.id)
      : Promise.resolve({ data: [], error: null }),
    supabase
      .from('virtus_ai_events')
      .select('points, reason')
      .eq('user_id', userId)
      .gte('created_at', `${date}T00:00:00`)
      .lt('created_at', `${nextDay}T00:00:00`),
  ]);

  if (sealedEvents.error) throw sealedEvents.error;
  if (aiEvents.error) throw aiEvents.error;

  const all: VirtusEventReason[] = [
    ...(sealedEvents.data ?? []).map((row) => ({ reason: row.label as string, points: row.points as number })),
    ...(aiEvents.data ?? []).map((row) => ({ reason: row.reason as string, points: row.points as number })),
  ];

  return {
    positive: all.filter((event) => event.points > 0),
    negative: all.filter((event) => event.points < 0),
  };
}
