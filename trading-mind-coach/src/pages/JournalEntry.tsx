import { useEffect, useRef, useState, type ChangeEvent, type ClipboardEvent, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useOmega } from '../contexts/OmegaContext';
import { useRefresh } from '../contexts/RefreshContext';
import { autoGrow } from '../lib/autoGrow';
import DatePicker from '../components/DatePicker';
import {
  applyOperationsPnlToAccounts,
  computeVirtusEventsV2,
  defaultTemplateSections,
  emotionalStates,
  emptyJournalEntry,
  emptyTradingPlan,
  getAllOperations,
  getDisciplineInputsByDate,
  getFriends,
  getFundingAccounts,
  getJournalEntryByDate,
  getJournalFundingAccountIds,
  getJournalTemplate,
  getMyAgoras,
  getOperations,
  getRecentEntrySealStatus,
  getRecentShareAgoraOrder,
  getRecentShareFriendOrder,
  getTradingPlan,
  getVirtusTotal,
  getWeeklyKillSwitchStatus,
  newOperation,
  logCoreMissionCompletions,
  logOperatorAndPsychMissionCompletions,
  postMarketQuizQuestions,
  psychologyEmotions,
  removeScreenshot,
  replaceJournalFundingAccounts,
  replaceOperations,
  replaceSetupMissionCompletions,
  replaceVirtusEvents,
  shareJournalEntry,
  shareJournalEntryToAgora,
  uploadScreenshot,
  upsertJournalEntryFull,
  type Agora,
  type Direction,
  type ExecutionWindow,
  type Friend,
  type FundingAccount,
  type JournalEntryFull,
  type JournalTemplateSections,
  type OperationItem,
  type TradingPlan,
  type WeeklyKillSwitchStatus,
} from '../lib/api';
import { localIsoDate } from '../lib/calendar';
import {
  findPlanNewsWarnings,
  formatEventTime,
  getEventsForDate,
  getWeeklyEconomicEvents,
  isWithinFetchedWeek,
  loadStoredNewsUtcOffset,
  saveStoredNewsUtcOffset,
  type EconomicEvent,
} from '../lib/economicCalendar';
import {
  computeDisciplineScore,
  computeDisciplineTimeline,
  hasAtaraxiaFlowStreak,
  type DailyDisciplineScore,
  type DisciplineOperationInput,
} from '../lib/disciplineScore';
import { downloadJournalEntry } from '../lib/journalExport';
import QuizQuestionRow from '../components/QuizQuestionRow';
import AtaraxiaBar from '../components/AtaraxiaBar';
import SessionSealedModal from '../components/SessionSealedModal';
import JournalInfoModal from '../components/JournalInfoModal';
import QuarantineScreen from '../components/QuarantineScreen';

function PhaseLocked({ title, message }: { title: string; message: string }) {
  return (
    <section className="panel plan-section je-section phase-locked">
      <span className="phase-locked-icon" aria-hidden="true">
        🔒
      </span>
      <h3>{title}</h3>
      <p className="hint-text">{message}</p>
    </section>
  );
}

const executionWindows: { value: ExecutionWindow; label: string }[] = [
  { value: 'london_open', label: 'London Open' },
  { value: 'ny_am', label: 'NY AM Session' },
  { value: 'ny_pm', label: 'NY PM Session' },
  { value: 'outside_window', label: 'Fuera de Ventana' },
];

function todayIso() {
  return localIsoDate(new Date());
}

const NEWS_FILTER_STORAGE_KEY = 'pat_news_filter';

// ---------------------------------------------------------------------------
// Auto-guardado de borrador — red de seguridad contra la pérdida de estado de
// React cuando el navegador descarta/suspende esta pestaña en segundo plano
// (no hay ningún listener de visibilitychange/focus en el código que fuerce
// un reload; es el propio navegador liberando memoria). Se persiste bajo una
// clave por fecha para no mezclar el borrador de un día con el de otro, y
// solo mientras la entrada no esté sellada del todo (una vez sellada, ya es
// inmutable y siempre se puede releer de Supabase — no hay nada que proteger).
// ---------------------------------------------------------------------------
type JournalDraft = {
  entry: JournalEntryFull;
  operations: OperationItem[];
  selectedFundingAccountIds: string[];
};

function journalDraftKey(date: string): string {
  return `omega_journal_draft_${date}`;
}

function loadJournalDraft(date: string): JournalDraft | null {
  try {
    const raw = localStorage.getItem(journalDraftKey(date));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || !parsed.entry) return null;
    return {
      entry: parsed.entry as JournalEntryFull,
      operations: Array.isArray(parsed.operations) ? (parsed.operations as OperationItem[]) : [],
      selectedFundingAccountIds: Array.isArray(parsed.selectedFundingAccountIds)
        ? (parsed.selectedFundingAccountIds as string[])
        : [],
    };
  } catch {
    // Borrador corrupto o localStorage no disponible (modo privado, cuota
    // llena) — se ignora y se sigue con lo que ya se cargó de Supabase.
    return null;
  }
}

function saveJournalDraft(date: string, draft: JournalDraft): void {
  try {
    localStorage.setItem(journalDraftKey(date), JSON.stringify(draft));
  } catch {
    // El auto-guardado es una capa extra, no debe romper el formulario si
    // localStorage falla (modo privado, cuota llena, etc.).
  }
}

function clearJournalDraft(date: string): void {
  try {
    localStorage.removeItem(journalDraftKey(date));
  } catch {
    // Nada que hacer si localStorage no está disponible.
  }
}

function loadStoredNewsFilter(): { hiddenImpacts: string[]; hiddenCurrencies: string[] } {
  try {
    const raw = localStorage.getItem(NEWS_FILTER_STORAGE_KEY);
    if (!raw) return { hiddenImpacts: [], hiddenCurrencies: [] };
    const parsed = JSON.parse(raw);
    return {
      hiddenImpacts: Array.isArray(parsed.hiddenImpacts) ? parsed.hiddenImpacts : [],
      hiddenCurrencies: Array.isArray(parsed.hiddenCurrencies) ? parsed.hiddenCurrencies : [],
    };
  } catch {
    return { hiddenImpacts: [], hiddenCurrencies: [] };
  }
}

function JournalEntry() {
  const { user } = useAuth();
  const { bump } = useRefresh();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const targetDate = searchParams.get('date') ?? todayIso();
  const blockedFrom = searchParams.get('blocked');

  const [entry, setEntry] = useState<JournalEntryFull>(emptyJournalEntry(targetDate));
  const [operations, setOperations] = useState<OperationItem[]>([]);
  const [plan, setPlan] = useState<TradingPlan>(emptyTradingPlan);
  const [template, setTemplate] = useState<JournalTemplateSections>(defaultTemplateSections());
  const [friends, setFriends] = useState<Friend[]>([]);
  const [friendOrder, setFriendOrder] = useState<string[]>([]);
  const [selectedFriendId, setSelectedFriendId] = useState<string | null>(null);
  const [friendMenuOpen, setFriendMenuOpen] = useState(false);
  const [agoras, setAgoras] = useState<Agora[]>([]);
  const [agoraOrder, setAgoraOrder] = useState<string[]>([]);
  const [selectedAgoraId, setSelectedAgoraId] = useState<string | null>(null);
  const [agoraMenuOpen, setAgoraMenuOpen] = useState(false);
  const [sharingAgora, setSharingAgora] = useState(false);
  const [shareAgoraMessage, setShareAgoraMessage] = useState<string | null>(null);
  const [econEvents, setEconEvents] = useState<EconomicEvent[]>([]);
  const [econLoading, setEconLoading] = useState(true);
  const [econError, setEconError] = useState<string | null>(null);
  const [econFilterOpen, setEconFilterOpen] = useState(false);
  const [hiddenImpacts, setHiddenImpacts] = useState<Set<string>>(
    () => new Set(loadStoredNewsFilter().hiddenImpacts),
  );
  const [hiddenCurrencies, setHiddenCurrencies] = useState<Set<string>>(
    () => new Set(loadStoredNewsFilter().hiddenCurrencies),
  );
  const [newsUtcOffset, setNewsUtcOffset] = useState<number>(() => loadStoredNewsUtcOffset());

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [uploadingShots, setUploadingShots] = useState(false);
  const [uploadingOpId, setUploadingOpId] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);
  const [shareMessage, setShareMessage] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [virtusTotal, setVirtusTotal] = useState(0);
  const [priorAtaraxiaTimeline, setPriorAtaraxiaTimeline] = useState<DailyDisciplineScore[]>([]);
  const [sealingPhase1, setSealingPhase1] = useState(false);
  const [sealingPhase2, setSealingPhase2] = useState(false);
  const [showSealedSummary, setShowSealedSummary] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [auditingSession, setAuditingSession] = useState(false);
  const [fundingAccounts, setFundingAccounts] = useState<FundingAccount[]>([]);
  const [selectedFundingAccountIds, setSelectedFundingAccountIds] = useState<string[]>([]);
  const [killSwitchStatus, setKillSwitchStatus] = useState<WeeklyKillSwitchStatus | null>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);
  const {
    evaluateSession,
    requestHeadCoachAudit,
    sending: omegaSending,
    lastEffects: omegaLastEffects,
    error: omegaError,
  } = useOmega();

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    async function load() {
      if (!user) return;
      setLoading(true);
      setSavedAt(null);
      setError(null);

      try {
        // Bloqueo: no se puede abrir un día distinto mientras el día anterior
        // más reciente siga sin sellar — se redirige a esa entrada en su lugar.
        const sealStatus = await getRecentEntrySealStatus(user.id, targetDate);
        if (cancelled) return;
        if (sealStatus && !sealStatus.sealed && sealStatus.entryDate !== targetDate) {
          navigate(`/journal/nuevo?date=${sealStatus.entryDate}&blocked=${targetDate}`, { replace: true });
          return;
        }

        const [
          existing,
          tradingPlan,
          friendList,
          templateData,
          agoraList,
          friendOrderList,
          agoraOrderList,
          vTotal,
          disciplineInputs,
          allOps,
          fundingAccountsList,
          killSwitch,
        ] = await Promise.all([
          getJournalEntryByDate(user.id, targetDate),
          getTradingPlan(user.id),
          getFriends(user.id),
          getJournalTemplate(user.id),
          getMyAgoras(user.id),
          getRecentShareFriendOrder(user.id),
          getRecentShareAgoraOrder(user.id),
          getVirtusTotal(user.id),
          getDisciplineInputsByDate(user.id),
          getAllOperations(user.id),
          getFundingAccounts(user.id),
          targetDate === todayIso() ? getWeeklyKillSwitchStatus(user.id, new Date()) : Promise.resolve(null),
        ]);

        if (cancelled) return;
        setKillSwitchStatus(killSwitch);

        const resolvedEntry = existing ?? emptyJournalEntry(targetDate);
        setPlan(tradingPlan ?? emptyTradingPlan);
        setFriends(friendList);
        setFriendOrder(friendOrderList);
        setTemplate(templateData);
        setAgoras(agoraList);
        setAgoraOrder(agoraOrderList);
        setVirtusTotal(vTotal);
        setFundingAccounts(fundingAccountsList.filter((account) => account.status === 'active'));

        // Sinergia Ataraxia × Virtus — solo sesiones ANTERIORES a hoy cuentan
        // para el chequeo de racha (hoy mismo se evalúa en vivo más abajo).
        const priorOpsByDate = new Map<string, DisciplineOperationInput[]>();
        allOps.forEach((op) => {
          if (op.entry_date >= targetDate) return;
          const list = priorOpsByDate.get(op.entry_date) ?? [];
          list.push({ model: op.model, session: op.session, brokePlan: op.broke_plan });
          priorOpsByDate.set(op.entry_date, list);
        });
        const priorEntries = Object.fromEntries(
          Object.entries(disciplineInputs).filter(([date]) => date < targetDate),
        );
        setPriorAtaraxiaTimeline(
          computeDisciplineTimeline(priorEntries, priorOpsByDate, tradingPlan?.max_trades_per_session ?? null),
        );

        let opsToUse: OperationItem[] = [];
        let fundingIdsToUse: string[] = [];

        if (resolvedEntry.id) {
          const [ops, linkedAccountIds] = await Promise.all([
            getOperations(resolvedEntry.id),
            getJournalFundingAccountIds(resolvedEntry.id),
          ]);
          if (cancelled) return;
          opsToUse = ops;
          fundingIdsToUse = linkedAccountIds;
          // Older entries saved before the Fase 2 gate existed have operations
          // but no explicit answer — infer it so the gate reflects real data.
          if (resolvedEntry.custom_fields.took_trade === null && ops.length > 0) {
            resolvedEntry.custom_fields.took_trade = true;
          }
        }

        // Recuperación de borrador — si el navegador descartó la pestaña a
        // mitad de la edición, el borrador local tiene ediciones más
        // recientes que lo que ya está en Supabase. Solo se usa mientras la
        // entrada no esté sellada del todo (una vez sellada es inmutable).
        // `id`/`entry_date` siempre quedan con el valor real de Supabase,
        // nunca con el del borrador, para no desincronizar a qué fila apunta
        // cada guardado posterior.
        let entryToUse = resolvedEntry;
        if (!resolvedEntry.custom_fields.sealed_at) {
          const draft = loadJournalDraft(targetDate);
          if (draft) {
            entryToUse = {
              ...resolvedEntry,
              ...draft.entry,
              id: resolvedEntry.id,
              entry_date: resolvedEntry.entry_date,
              custom_fields: { ...resolvedEntry.custom_fields, ...draft.entry.custom_fields },
            };
            opsToUse = draft.operations;
            fundingIdsToUse = draft.selectedFundingAccountIds;
          }
        }

        setOperations(opsToUse);
        setSelectedFundingAccountIds(fundingIdsToUse);
        setEntry(entryToUse);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'No se pudo cargar el journal.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [user, targetDate]);

  // Auto-guardado continuo del borrador — corre en cada cambio de lo que el
  // trader ya escribió/seleccionó. `loading` evita pisar un borrador real con
  // el estado vacío/por-defecto que existe un instante antes de que la carga
  // de arriba termine de reconciliarlo; `sealed_at` evita seguir escribiendo
  // sobre una entrada ya inmutable (no hay nada más que proteger ahí).
  useEffect(() => {
    if (loading || entry.custom_fields.sealed_at) return;
    saveJournalDraft(targetDate, { entry, operations, selectedFundingAccountIds });
  }, [entry, operations, selectedFundingAccountIds, targetDate, loading]);

  useEffect(() => {
    let cancelled = false;
    setEconLoading(true);
    setEconError(null);

    getWeeklyEconomicEvents()
      .then((events) => {
        if (!cancelled) setEconEvents(events);
      })
      .catch((err: Error) => {
        if (!cancelled) setEconError(err.message);
      })
      .finally(() => {
        if (!cancelled) setEconLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    localStorage.setItem(
      NEWS_FILTER_STORAGE_KEY,
      JSON.stringify({ hiddenImpacts: [...hiddenImpacts], hiddenCurrencies: [...hiddenCurrencies] }),
    );
  }, [hiddenImpacts, hiddenCurrencies]);

  const toggleHidden = (set: Set<string>, value: string): Set<string> => {
    const next = new Set(set);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    return next;
  };

  const toggleEmotion = (emotion: string) => {
    setEntry((current) => {
      const active = current.custom_fields.psychology_emotions.includes(emotion);
      const next = active
        ? current.custom_fields.psychology_emotions.filter((item) => item !== emotion)
        : [...current.custom_fields.psychology_emotions, emotion];
      return { ...current, custom_fields: { ...current.custom_fields, psychology_emotions: next } };
    });
  };

  const handleDownload = async () => {
    setDownloading(true);
    try {
      await downloadJournalEntry(entry, operations, template, disciplineResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo generar la descarga del journal.');
    } finally {
      setDownloading(false);
    }
  };

  const setEntryField = <K extends keyof JournalEntryFull>(key: K, value: JournalEntryFull[K]) => {
    setEntry((current) => ({ ...current, [key]: value }));
  };

  const setTopDown = (group: 'htf' | 'ltf', field: string, value: string) => {
    setEntry((current) => ({
      ...current,
      top_down: { ...current.top_down, [group]: { ...current.top_down[group], [field]: value } },
    }));
  };

  const setCustomField = (key: keyof JournalEntryFull['custom_fields'], value: string | boolean | null) => {
    setEntry((current) => ({ ...current, custom_fields: { ...current.custom_fields, [key]: value } }));
  };

  const updateOperation = (id: string, patch: Partial<OperationItem>) => {
    setOperations((current) => current.map((op) => (op.id === id ? { ...op, ...patch } : op)));
  };

  const handleNewsUtcOffsetChange = (offset: number) => {
    setNewsUtcOffset(offset);
    saveStoredNewsUtcOffset(offset);
  };

  const toggleFundingAccount = (accountId: string) => {
    setSelectedFundingAccountIds((current) =>
      current.includes(accountId) ? current.filter((id) => id !== accountId) : [...current, accountId],
    );
  };

  const toggleOperationFundingAccount = (operationId: string, accountId: string) => {
    setOperations((current) =>
      current.map((op) =>
        op.id === operationId
          ? {
              ...op,
              fundingAccountIds: op.fundingAccountIds.includes(accountId)
                ? op.fundingAccountIds.filter((id) => id !== accountId)
                : [...op.fundingAccountIds, accountId],
            }
          : op,
      ),
    );
  };

  const handleFiles = async (files: FileList | File[]) => {
    if (!user) return;
    const remaining = 10 - entry.screenshots.length;
    const toUpload = Array.from(files).slice(0, remaining);
    if (toUpload.length === 0) return;

    setUploadingShots(true);
    setError(null);
    try {
      for (const file of toUpload) {
        const shot = await uploadScreenshot(user.id, entry.entry_date, file, file.name || 'captura.png');
        setEntry((current) => ({ ...current, screenshots: [...current.screenshots, shot] }));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo subir la captura.');
    } finally {
      setUploadingShots(false);
    }
  };

  const handleFileInput = (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) handleFiles(event.target.files);
    event.target.value = '';
  };

  const handlePaste = (event: ClipboardEvent<HTMLDivElement>) => {
    const files = Array.from(event.clipboardData.items)
      .filter((item) => item.type.startsWith('image/'))
      .map((item) => item.getAsFile())
      .filter((file): file is File => file !== null);
    if (files.length > 0) handleFiles(files);
  };

  const handleRemoveScreenshot = async (path: string) => {
    try {
      await removeScreenshot(path);
      setEntry((current) => ({ ...current, screenshots: current.screenshots.filter((s) => s.path !== path) }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo eliminar la captura.');
    }
  };

  const handleOperationFiles = async (opId: string, files: FileList | File[]) => {
    if (!user) return;
    const op = operations.find((item) => item.id === opId);
    if (!op) return;
    const remaining = 10 - op.screenshots.length;
    const toUpload = Array.from(files).slice(0, remaining);
    if (toUpload.length === 0) return;

    setUploadingOpId(opId);
    setError(null);
    try {
      for (const file of toUpload) {
        const shot = await uploadScreenshot(user.id, entry.entry_date, file, file.name || 'captura.png', `ops/${opId}`);
        setOperations((current) =>
          current.map((item) => (item.id === opId ? { ...item, screenshots: [...item.screenshots, shot] } : item)),
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo subir la captura.');
    } finally {
      setUploadingOpId(null);
    }
  };

  const handleOperationFileInput = (opId: string, event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) handleOperationFiles(opId, event.target.files);
    event.target.value = '';
  };

  const handleOperationPaste = (opId: string, event: ClipboardEvent<HTMLDivElement>) => {
    const files = Array.from(event.clipboardData.items)
      .filter((item) => item.type.startsWith('image/'))
      .map((item) => item.getAsFile())
      .filter((file): file is File => file !== null);
    if (files.length > 0) handleOperationFiles(opId, files);
  };

  const handleRemoveOperationScreenshot = async (opId: string, path: string) => {
    try {
      await removeScreenshot(path);
      setOperations((current) =>
        current.map((item) =>
          item.id === opId ? { ...item, screenshots: item.screenshots.filter((s) => s.path !== path) } : item,
        ),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo eliminar la captura.');
    }
  };

  const handleShare = async () => {
    if (!user || !entry.id || !selectedFriendId) return;
    setSharing(true);
    setShareMessage(null);
    try {
      await shareJournalEntry(user.id, selectedFriendId, entry.id);
      setShareMessage('Entrada compartida.');
      setFriendOrder((current) => [selectedFriendId, ...current.filter((id) => id !== selectedFriendId)]);
    } catch (err) {
      setShareMessage(err instanceof Error ? err.message : 'No se pudo compartir.');
    } finally {
      setSharing(false);
    }
  };

  const handleShareAgora = async () => {
    if (!user || !entry.id || !selectedAgoraId) return;
    setSharingAgora(true);
    setShareAgoraMessage(null);
    try {
      const count = await shareJournalEntryToAgora(user.id, entry.id, selectedAgoraId);
      setShareAgoraMessage(
        count > 0 ? `Entrada compartida con ${count} miembro${count === 1 ? '' : 's'}.` : 'No hay otros miembros en ese Ágora todavía.',
      );
      setAgoraOrder((current) => [selectedAgoraId, ...current.filter((id) => id !== selectedAgoraId)]);
    } catch (err) {
      setShareAgoraMessage(err instanceof Error ? err.message : 'No se pudo compartir.');
    } finally {
      setSharingAgora(false);
    }
  };

  // Sella la Fase 1 (Pre-sesión) — persiste lo escrito hasta ahora y lo
  // congela permanentemente; desbloquea la Fase 2.
  const handleSealPhase1 = async () => {
    if (!user) return;
    setSealingPhase1(true);
    setError(null);
    try {
      const entryToSave: JournalEntryFull = {
        ...entry,
        custom_fields: { ...entry.custom_fields, phase1_sealed_at: new Date().toISOString() },
      };
      const entryId = await upsertJournalEntryFull(user.id, entryToSave);
      setEntry((current) => ({ ...current, id: entryId, custom_fields: entryToSave.custom_fields }));
      setSavedAt(Date.now());
      bump();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo sellar la Fase 1.');
    } finally {
      setSealingPhase1(false);
    }
  };

  // Sella la Fase 2 (Ejecución) — persiste las operaciones y congela lo
  // escrito hasta ahora; desbloquea la Fase 3.
  const handleSealPhase2 = async () => {
    if (!user) return;
    setSealingPhase2(true);
    setError(null);
    try {
      const entryToSave: JournalEntryFull = {
        ...entry,
        custom_fields: { ...entry.custom_fields, phase2_sealed_at: new Date().toISOString() },
      };
      const entryId = await upsertJournalEntryFull(user.id, entryToSave);
      await replaceOperations(user.id, entryId, entry.entry_date, operations);
      await replaceJournalFundingAccounts(user.id, entryId, selectedFundingAccountIds);
      await applyOperationsPnlToAccounts(user.id, entryId, operations);
      setEntry((current) => ({ ...current, id: entryId, custom_fields: entryToSave.custom_fields }));
      setSavedAt(Date.now());
      bump();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo sellar la Fase 2.');
    } finally {
      setSealingPhase2(false);
    }
  };

  // Sello final (Fase 3 · Post-mercado) — calcula y guarda los puntos Virtus
  // de la sesión, congela toda la entrada y muestra el resumen de Ataraxia.
  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!user) return;

    setSubmitting(true);
    setError(null);

    try {
      // Only overwrite the news record when we actually have fresh data for
      // this date — the feed only covers the current week, so recording
      // "no news" for a day we never checked would be a fabricated negative.
      const hasFreshNewsData = isWithinFetchedWeek(entry.entry_date) && !econLoading && !econError;
      const entryToSave: JournalEntryFull = {
        ...entry,
        custom_fields: {
          ...entry.custom_fields,
          ...(hasFreshNewsData
            ? {
                had_macro_news: todaysEconEvents.length > 0,
                macro_news: todaysEconEvents.map((event) => ({
                  title: event.title,
                  country: event.country,
                  impact: event.impact,
                  time: event.date,
                })),
              }
            : {}),
          sealed_at: new Date().toISOString(),
        },
      };

      const entryId = await upsertJournalEntryFull(user.id, entryToSave);
      await replaceOperations(user.id, entryId, entry.entry_date, operations);
      const events = computeVirtusEventsV2(entry, operations, {
        areteScoreToday: disciplineResult.score,
        areteFlowStreakActive,
        virtusTotalBeforeToday: virtusTotal,
      });
      await replaceVirtusEvents(user.id, entryId, events);
      await logCoreMissionCompletions(user.id, entryToSave.entry_date, {
        hasEntry: true,
        emotionalStateSet: entryToSave.emotional_state !== null,
        operationsCount: operations.length,
        directrizSet: Boolean(entryToSave.directriz && entryToSave.directriz.trim().length > 0),
        quizCompleted: postMarketQuizQuestions.every(
          (question) => entryToSave.custom_fields.quiz[question.key]?.answer !== null,
        ),
      });
      await logOperatorAndPsychMissionCompletions(user.id, {
        entryDate: entryToSave.entry_date,
        entry: entryToSave,
        ataraxiaScore: disciplineResult.score,
      });
      await replaceSetupMissionCompletions(user.id, entryToSave.entry_date, operations, plan.setups);

      setEntry((current) => ({ ...current, id: entryId, custom_fields: entryToSave.custom_fields }));
      setSavedAt(Date.now());
      setShowSealedSummary(true);
      bump();

      // El borrador local solo se descarta acá — justo después de que todo
      // lo de arriba (upsert, operaciones, Virtus, misiones) ya se guardó
      // con éxito en Supabase. Si algo de eso hubiera fallado, habríamos
      // caído al catch de abajo sin llegar a esta línea, y el borrador sigue
      // intacto para reintentar.
      clearJournalDraft(entryToSave.entry_date);

      // Auditoría automática de Omega — el sello del journal (lo crítico) ya
      // terminó arriba; esto corre aparte, sin bloquear ni poder invalidar lo
      // que ya se guardó si Omega falla o tarda. requestHeadCoachAudit es la
      // MISMA llamada que antes disparaba el botón "Auditar Última Sesión"
      // en Omega Coach — ahora se dispara sola al sellar, así las pestañas
      // Estado/Conversación/Objetivos tienen data real del día sin que el
      // trader tenga que pedirla a mano.
      setAuditingSession(true);
      evaluateSession(entryToSave.entry_date).catch(() => {});
      // Segundo bump() cuando esto termina (además del de arriba, que ya
      // disparó al sellar) — así, si el trader está mirando Omega Coach,
      // sus pestañas Estado/Conversación/Objetivos se destraban solas en
      // cuanto la auditoría real está lista, sin que tenga que recargar.
      requestHeadCoachAudit()
        .then(() => bump())
        .catch(() => {});
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar el journal.');
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    if (!auditingSession || omegaSending) return;
    setAuditingSession(false);
  }, [auditingSession, omegaSending]);

  const sortedFriends = [...friends].sort((a, b) => {
    const rankA = friendOrder.indexOf(a.userId);
    const rankB = friendOrder.indexOf(b.userId);
    if (rankA === -1 && rankB === -1) return 0;
    if (rankA === -1) return 1;
    if (rankB === -1) return -1;
    return rankA - rankB;
  });
  const selectedFriend = friends.find((f) => f.userId === selectedFriendId) ?? null;

  const sortedAgoras = [...agoras].sort((a, b) => {
    const rankA = agoraOrder.indexOf(a.id);
    const rankB = agoraOrder.indexOf(b.id);
    if (rankA === -1 && rankB === -1) return 0;
    if (rankA === -1) return 1;
    if (rankB === -1) return -1;
    return rankA - rankB;
  });
  const selectedAgora = agoras.find((a) => a.id === selectedAgoraId) ?? null;

  const todaysEconEvents = getEventsForDate(econEvents, entry.entry_date);
  const impactPriority = ['High', 'Medium', 'Low', 'Holiday'];
  const availableImpacts = [...new Set(econEvents.map((event) => event.impact))].sort(
    (a, b) => impactPriority.indexOf(a) - impactPriority.indexOf(b),
  );
  const availableCurrencies = [...new Set(econEvents.map((event) => event.country))].sort();
  const filteredEconEvents = todaysEconEvents.filter(
    (event) => !hiddenImpacts.has(event.impact) && !hiddenCurrencies.has(event.country),
  );
  const planNewsWarnings = findPlanNewsWarnings(plan.no_trade_days, todaysEconEvents);

  const disciplineResult = computeDisciplineScore({
    directriz: entry.directriz,
    quiz: entry.custom_fields.quiz,
    psychologyEmotions: entry.custom_fields.psychology_emotions,
    operations: operations.map((op) => ({ model: op.model, session: op.session, brokePlan: op.brokePlan })),
    maxTradesPerSession: plan.max_trades_per_session,
  });

  // Sinergia Ataraxia × Virtus — recalculado en vivo mientras se edita el journal.
  const areteFlowStreakActive = hasAtaraxiaFlowStreak(priorAtaraxiaTimeline, disciplineResult.score);
  const areteTiltActive = disciplineResult.score !== null && disciplineResult.score <= 35;
  const mostRecentPriorAtaraxia = [...priorAtaraxiaTimeline].sort((a, b) => a.date.localeCompare(b.date)).pop();
  const areteDelta =
    disciplineResult.score !== null && mostRecentPriorAtaraxia
      ? disciplineResult.score - mostRecentPriorAtaraxia.score
      : null;

  // Sellado por fases — una vez sellada, esa fase queda inmutable para
  // siempre (sin forma de des-sellarla), y la siguiente se desbloquea.
  const phase1Sealed = Boolean(entry.custom_fields.phase1_sealed_at);
  const phase2Sealed = Boolean(entry.custom_fields.phase2_sealed_at);
  const fullySealed = Boolean(entry.custom_fields.sealed_at);

  const phase1Valid = Boolean(entry.emotional_state) && Boolean(entry.directriz && entry.directriz.trim());
  const phase2Valid =
    entry.custom_fields.took_trade === false ||
    (entry.custom_fields.took_trade === true &&
      operations.length > 0 &&
      operations.every((op) => op.screenshots.length > 0));
  const phase3Valid =
    postMarketQuizQuestions.every((question) => entry.custom_fields.quiz[question.key]?.answer !== null) &&
    Boolean(entry.post_market_analysis && entry.post_market_analysis.trim());

  if (loading) {
    return <div className="skeleton skeleton-table" />;
  }

  if (targetDate === todayIso() && killSwitchStatus?.triggered) {
    return <QuarantineScreen status={killSwitchStatus} />;
  }

  return (
    <>
      <header className="topbar panel">
        <button
          type="button"
          className="info-btn"
          onClick={() => setInfoOpen(true)}
          aria-label="Cómo funciona el Journal"
        >
          ℹ
        </button>
        <div>
          <Link to="/dashboard" className="back-link">
            ← Volver al dashboard
          </Link>
          <h2 style={{ marginTop: 10 }}>{entry.id ? 'Editar Journal' : 'Nuevo Journal'}</h2>
          <p className="page-description">
            Registra la directriz del día, el contexto y las operaciones que ejecutaste.
          </p>
        </div>
      </header>

      {blockedFrom && (
        <div className="phase-seal-banner">
          Tienes el journal del <strong>{targetDate}</strong> sin sellar — debes completarlo antes de abrir el del{' '}
          <strong>{blockedFrom}</strong>.
        </div>
      )}

      <form onSubmit={handleSubmit} className="journal-form">
        <p className="phase-label">Fase 1 · Pre-sesión</p>

        <fieldset className="phase-fieldset" disabled={phase1Sealed}>
        <section className="panel plan-section je-section">
          <div className="auth-field">
            <span className="eyebrow">Fecha</span>
            <DatePicker value={entry.entry_date} onChange={(value) => setEntryField('entry_date', value)} />
          </div>

          <div className="pill-field">
            <span className="eyebrow">Estado emocional</span>
            <div className="pill-row">
              {emotionalStates.map((state) => (
                <button
                  key={state}
                  type="button"
                  className={`pill-btn gold small ${entry.emotional_state === state ? 'active' : ''}`}
                  onClick={() => setEntryField('emotional_state', state)}
                >
                  {state}
                </button>
              ))}
            </div>
          </div>

          <label className="auth-field">
            <span className="eyebrow">Directriz operativa</span>
            <textarea
              onInput={autoGrow}
              value={entry.directriz ?? ''}
              onChange={(event) => setEntryField('directriz', event.target.value)}
              placeholder="¿Cuál era el plan antes de operar?"
              rows={3}
            />
          </label>
        </section>

        <section className="panel plan-section je-section">
          <div className="section-header">
            <h3>Eventos macroeconómicos</h3>
            <div className="econ-header-actions">
              {!econLoading && !econError && econEvents.length > 0 && (
                <select
                  className="news-utc-select"
                  value={newsUtcOffset}
                  onChange={(event) => handleNewsUtcOffsetChange(Number(event.target.value))}
                  aria-label="Zona horaria de las noticias"
                  title="Zona horaria de las noticias"
                >
                  {Array.from({ length: 27 }, (_, i) => i - 12).map((offset) => (
                    <option key={offset} value={offset}>
                      UTC{offset >= 0 ? '+' : ''}
                      {offset}
                    </option>
                  ))}
                </select>
              )}
              {!econLoading && !econError && econEvents.length > 0 && (
                <button
                  type="button"
                  className="ghost-btn btn-sm filter-toggle-btn"
                  onClick={() => setEconFilterOpen((open) => !open)}
                >
                  Filtrar
                  {(hiddenImpacts.size > 0 || hiddenCurrencies.size > 0) && (
                    <span className="filter-active-chip">
                      {availableImpacts.length - hiddenImpacts.size}/{availableImpacts.length} impacto ·{' '}
                      {availableCurrencies.length - hiddenCurrencies.size}/{availableCurrencies.length} índices
                    </span>
                  )}
                  {econFilterOpen ? '▴' : '▾'}
                </button>
              )}
            </div>
          </div>

          {planNewsWarnings.length > 0 && (
            <div className="plan-news-warning">
              <strong>
                Tu Manual Operativo dice que evitas operar en días de{' '}
                {planNewsWarnings.map((warning) => warning.keyword.toUpperCase()).join(' y ')}.
              </strong>
              <p>
                Hoy hay eventos que coinciden:{' '}
                {planNewsWarnings
                  .flatMap((warning) => warning.events.map((event) => event.title))
                  .join(', ')}
                .
              </p>
            </div>
          )}

          {econFilterOpen && !econLoading && !econError && (
            <div className="econ-filter-panel">
              <div className="econ-filter-group">
                <span className="eyebrow">Impacto</span>
                <div className="pill-row">
                  {availableImpacts.map((impact) => (
                    <button
                      key={impact}
                      type="button"
                      className={`pill-btn gold small ${hiddenImpacts.has(impact) ? '' : 'active'}`}
                      onClick={() => setHiddenImpacts((current) => toggleHidden(current, impact))}
                    >
                      {impact}
                    </button>
                  ))}
                </div>
              </div>
              <div className="econ-filter-group">
                <span className="eyebrow">Índice / Moneda</span>
                <div className="pill-row">
                  {availableCurrencies.map((currency) => (
                    <button
                      key={currency}
                      type="button"
                      className={`pill-btn gold small ${hiddenCurrencies.has(currency) ? '' : 'active'}`}
                      onClick={() => setHiddenCurrencies((current) => toggleHidden(current, currency))}
                    >
                      {currency}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {econLoading ? (
            <div className="skeleton skeleton-text" />
          ) : econError ? (
            <p className="hint-text">No se pudo cargar el calendario económico ahora mismo.</p>
          ) : todaysEconEvents.length === 0 ? (
            <p className="hint-text">
              No hay eventos relevantes para este día en la semana actual del calendario económico.
            </p>
          ) : filteredEconEvents.length === 0 ? (
            <p className="hint-text">Ningún evento de este día coincide con los filtros elegidos.</p>
          ) : (
            <div className="econ-event-list">
              {filteredEconEvents.map((event, index) => (
                <div className="econ-event-row" key={index}>
                  <span className="econ-event-time">{formatEventTime(event.date, newsUtcOffset)}</span>
                  <span className="econ-event-currency">{event.country}</span>
                  <span className={`econ-impact-badge ${event.impact.toLowerCase()}`}>{event.impact}</span>
                  <span className="econ-event-title">{event.title}</span>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="panel plan-section je-section">
          <h3>Top Down (HTF)</h3>
          {template.htf.map((field) => (
            <label className="auth-field" key={field}>
              <span className="eyebrow">{field}</span>
              <textarea
                className="compact-textarea"
                rows={1}
                onInput={autoGrow}
                value={entry.top_down.htf[field] ?? ''}
                onChange={(event) => setTopDown('htf', field, event.target.value)}
              />
            </label>
          ))}
        </section>

        <section className="panel plan-section je-section">
          <h3>Top Down (LTF)</h3>
          {template.ltf.map((field) => (
            <label className="auth-field" key={field}>
              <span className="eyebrow">{field}</span>
              <textarea
                className="compact-textarea"
                rows={1}
                onInput={autoGrow}
                value={entry.top_down.ltf[field] ?? ''}
                onChange={(event) => setTopDown('ltf', field, event.target.value)}
              />
            </label>
          ))}
        </section>

        <section className="panel plan-section je-section">
          <h3>Draw on Liquidity (DOL)</h3>
          <label className="auth-field">
            <span className="eyebrow">Contexto</span>
            <textarea
              className="compact-textarea"
              rows={1}
              onInput={autoGrow}
              value={entry.market_context ?? ''}
              onChange={(event) => setEntryField('market_context', event.target.value)}
            />
          </label>
          <label className="auth-field">
            <span className="eyebrow">DOL (target)</span>
            <textarea
              className="compact-textarea"
              rows={1}
              onInput={autoGrow}
              value={entry.custom_fields.dol_target}
              onChange={(event) => setCustomField('dol_target', event.target.value)}
            />
          </label>
          <label className="auth-field">
            <span className="eyebrow">Punto de invalidación (hard stop)</span>
            <textarea
              className="compact-textarea"
              rows={1}
              onInput={autoGrow}
              value={entry.custom_fields.dol_invalidation}
              onChange={(event) => setCustomField('dol_invalidation', event.target.value)}
            />
          </label>
        </section>

        <section className="panel plan-section je-section">
          <div className="section-header">
            <h3>Capturas de pantalla</h3>
            <span className="hint-text">{entry.screenshots.length}/10</span>
          </div>

          <div
            className="screenshot-dropzone"
            ref={dropZoneRef}
            onPaste={handlePaste}
            tabIndex={0}
          >
            <label className="screenshot-upload-label">
              {uploadingShots ? 'Subiendo…' : `Agregar capturas (${10 - entry.screenshots.length} restantes)`}
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={handleFileInput}
                disabled={entry.screenshots.length >= 10 || uploadingShots}
                hidden
              />
            </label>
            <p className="hint-text">o presiona Ctrl+V para pegar una captura copiada</p>
          </div>

          {entry.screenshots.length > 0 && (
            <div className="screenshot-grid">
              {entry.screenshots.map((shot) => (
                <div className="screenshot-thumb" key={shot.path}>
                  <img src={shot.url} alt="Captura del journal" />
                  <button type="button" className="icon-btn" onClick={() => handleRemoveScreenshot(shot.path)}>
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
        </fieldset>

        <div className="share-card-grid">
          <section className="panel plan-section je-section share-card">
            <h3>Fraternidad</h3>
            <p className="hint-text">Envía esta entrada a un amigo para que te dé feedback.</p>

            {!entry.id ? (
              <p className="hint-text">Guarda el journal primero para poder compartirlo.</p>
            ) : friends.length === 0 ? (
              <p className="hint-text">Aún no tienes amigos agregados.</p>
            ) : (
              <>
                <div className="share-select">
                  <button
                    type="button"
                    className="share-select-btn"
                    onClick={() => setFriendMenuOpen((open) => !open)}
                  >
                    {selectedFriend ? selectedFriend.label : 'Elegir amigo'}
                    <span className="share-select-chevron">{friendMenuOpen ? '▴' : '▾'}</span>
                  </button>
                  {friendMenuOpen && (
                    <div className="share-select-menu">
                      {sortedFriends.map((friend) => (
                        <button
                          key={friend.userId}
                          type="button"
                          className={`share-select-option ${
                            friendOrder[0] === friend.userId ? 'recent' : ''
                          } ${selectedFriendId === friend.userId ? 'active' : ''}`}
                          onClick={() => {
                            setSelectedFriendId(friend.userId);
                            setFriendMenuOpen(false);
                          }}
                        >
                          <span className="share-avatar">{friend.label.slice(0, 2).toUpperCase()}</span>
                          {friend.label}
                          {friendOrder[0] === friend.userId && (
                            <span className="share-recent-tag">Último</span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  className="primary-btn btn-sm share-card-submit"
                  disabled={!selectedFriendId || sharing}
                  onClick={handleShare}
                >
                  {sharing ? 'Enviando…' : 'Compartir'}
                </button>
              </>
            )}
            {shareMessage && <p className="hint-text">{shareMessage}</p>}
          </section>

          <section className="panel plan-section je-section share-card">
            <h3>Ágora</h3>
            <p className="hint-text">Envía esta entrada a todos los miembros del grupo.</p>

            {!entry.id ? (
              <p className="hint-text">Guarda el journal primero para poder compartirlo.</p>
            ) : agoras.length === 0 ? (
              <p className="hint-text">
                Aún no perteneces a ningún Ágora. Crea uno en{' '}
                <Link to="/agoras" className="back-link">
                  Ágoras
                </Link>
                .
              </p>
            ) : (
              <>
                <div className="share-select">
                  <button
                    type="button"
                    className="share-select-btn"
                    onClick={() => setAgoraMenuOpen((open) => !open)}
                  >
                    {selectedAgora ? selectedAgora.name : 'Elegir Ágora'}
                    <span className="share-select-chevron">{agoraMenuOpen ? '▴' : '▾'}</span>
                  </button>
                  {agoraMenuOpen && (
                    <div className="share-select-menu">
                      {sortedAgoras.map((agora) => (
                        <button
                          key={agora.id}
                          type="button"
                          className={`share-select-option ${
                            agoraOrder[0] === agora.id ? 'recent' : ''
                          } ${selectedAgoraId === agora.id ? 'active' : ''}`}
                          onClick={() => {
                            setSelectedAgoraId(agora.id);
                            setAgoraMenuOpen(false);
                          }}
                        >
                          <span className="share-avatar">{agora.name.slice(0, 2).toUpperCase()}</span>
                          {agora.name}
                          {agoraOrder[0] === agora.id && <span className="share-recent-tag">Último</span>}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  className="primary-btn btn-sm share-card-submit"
                  disabled={!selectedAgoraId || sharingAgora}
                  onClick={handleShareAgora}
                >
                  {sharingAgora ? 'Enviando…' : 'Compartir'}
                </button>
              </>
            )}
            {shareAgoraMessage && <p className="hint-text">{shareAgoraMessage}</p>}
          </section>
        </div>

        {!phase1Sealed ? (
          <div className="journal-submit-row">
            <button
              type="button"
              className="primary-btn btn-sm"
              disabled={!phase1Valid || sealingPhase1}
              onClick={handleSealPhase1}
            >
              {sealingPhase1 ? 'Sellando…' : 'Sellar Análisis'}
            </button>
            {savedAt && <span className="save-status saved">Guardado</span>}
          </div>
        ) : (
          <p className="phase-sealed-note">
            🔒 Fase 1 sellada el {new Date(entry.custom_fields.phase1_sealed_at as string).toLocaleString('es-ES')}
          </p>
        )}

        <p className="phase-label">Fase 2 · Ejecución</p>

        {!phase1Sealed ? (
          <PhaseLocked title="Ejecución bloqueada" message="Se desbloquea cuando sellas el Análisis de la Fase 1." />
        ) : (
        <>
        <fieldset className="phase-fieldset" disabled={phase2Sealed}>
        <section className="panel plan-section je-section">
          <div className="pill-field">
            <span className="eyebrow">¿Tomaste un trade hoy?</span>
            <div className="pill-row">
              <button
                type="button"
                className={`pill-btn long small ${entry.custom_fields.took_trade === true ? 'active' : ''}`}
                onClick={() => setCustomField('took_trade', true)}
              >
                Sí
              </button>
              <button
                type="button"
                className={`pill-btn short small ${entry.custom_fields.took_trade === false ? 'active' : ''}`}
                onClick={() => setCustomField('took_trade', false)}
              >
                No
              </button>
            </div>
          </div>
        </section>

        {entry.custom_fields.took_trade === true && (
        <section className="panel plan-section je-section">
          <div className="section-header">
            <h3>Cuentas de Fondeo</h3>
            <span className="hint-text">¿en cuál(es) se ejecutó esta sesión?</span>
          </div>
          {fundingAccounts.length === 0 ? (
            <p className="hint-text">
              No tenés cuentas activas registradas. Agrega una en{' '}
              <Link to="/conexiones">Conexiones</Link> para poder asociarla a tus sesiones.
            </p>
          ) : (
            <div className="funding-account-checklist">
              {fundingAccounts.map((account) => (
                <label key={account.id} className="funding-account-check-row">
                  <input
                    type="checkbox"
                    checked={selectedFundingAccountIds.includes(account.id)}
                    onChange={() => toggleFundingAccount(account.id)}
                  />
                  <span>{account.accountName}</span>
                  {account.accountNumber && <span className="hint-text">#{account.accountNumber}</span>}
                </label>
              ))}
            </div>
          )}
        </section>
        )}

        {entry.custom_fields.took_trade === true && (
        <section className="panel plan-section je-section">
          <div className="section-header">
            <h3>Operaciones</h3>
            <button
              type="button"
              className="ghost-btn btn-sm"
              onClick={() => setOperations((current) => [...current, newOperation()])}
            >
              + Agregar operación
            </button>
          </div>

          <div className="repeatable-list">
            {operations.map((op, index) => (
              <div className="repeatable-card" key={op.id}>
                <div className="repeatable-card-header">
                  <span className="eyebrow">Operación {index + 1}</span>
                  <button
                    type="button"
                    className="icon-btn"
                    onClick={() => setOperations((current) => current.filter((item) => item.id !== op.id))}
                  >
                    ✕
                  </button>
                </div>

                <div className="field-grid-2">
                  <label className="auth-field">
                    <span className="eyebrow">Símbolo</span>
                    <input
                      type="text"
                      value={op.symbol}
                      onChange={(event) => updateOperation(op.id, { symbol: event.target.value })}
                      placeholder="NQ, ES, EURUSD…"
                    />
                  </label>

                  <div className="pill-field">
                    <span className="eyebrow">Dirección</span>
                    <div className="pill-row">
                      {(['long', 'short'] as Direction[]).map((direction) => (
                        <button
                          key={direction}
                          type="button"
                          className={`pill-btn ${direction} small ${op.direction === direction ? 'active' : ''}`}
                          onClick={() => updateOperation(op.id, { direction })}
                        >
                          {direction === 'long' ? 'LONG' : 'SHORT'}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <label className="auth-field">
                  <span className="eyebrow">Cuenta (opcional)</span>
                  <input
                    type="text"
                    value={op.accountLabel ?? ''}
                    onChange={(event) => updateOperation(op.id, { accountLabel: event.target.value || null })}
                    placeholder="Ej. Lucid 50K #1"
                    disabled={op.isAutoSynced}
                  />
                </label>

                {fundingAccounts.length > 0 && (
                  <div className="pill-field">
                    <span className="eyebrow">Cuenta(s) de Conexiones (el P&L se aplica al sellar)</span>
                    <div className="funding-account-checklist compact">
                      {fundingAccounts.map((account) => (
                        <label key={account.id} className="funding-account-check-row">
                          <input
                            type="checkbox"
                            checked={op.fundingAccountIds.includes(account.id)}
                            onChange={() => toggleOperationFundingAccount(op.id, account.id)}
                          />
                          <span>{account.accountName}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                <div className="pill-field">
                  <span className="eyebrow">Modelo / setup</span>
                  {plan.setups.length === 0 ? (
                    <p className="hint-text">Aún no defines setups en tu manual operativo.</p>
                  ) : (
                    <div className="pill-row">
                      {plan.setups
                        .filter((setup) => setup.name.trim())
                        .map((setup) => (
                          <button
                            key={setup.id}
                            type="button"
                            className={`pill-btn gold small ${op.model === setup.name ? 'active' : ''}`}
                            onClick={() => updateOperation(op.id, { model: setup.name })}
                          >
                            {setup.name}
                          </button>
                        ))}
                    </div>
                  )}
                </div>

                <div className="field-grid-2">
                  <div className="pill-field">
                    <span className="eyebrow">Calidad de setup</span>
                    <div className="pill-row">
                      {plan.quality_tiers.map((quality) => (
                        <button
                          key={quality}
                          type="button"
                          className={`pill-btn gold small ${op.quality === quality ? 'active' : ''}`}
                          onClick={() => updateOperation(op.id, { quality })}
                        >
                          {quality}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="pill-field">
                    <span className="eyebrow">Sesión</span>
                    <div className="pill-row">
                      {executionWindows.map((window) => (
                        <button
                          key={window.value}
                          type="button"
                          className={`pill-btn gold small ${op.session === window.value ? 'active' : ''}`}
                          onClick={() => updateOperation(op.id, { session: window.value })}
                        >
                          {window.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="field-grid-3">
                  <label className="auth-field">
                    <span className="eyebrow">Entry</span>
                    <input
                      type="number"
                      step="any"
                      value={op.entryPrice}
                      onChange={(event) => updateOperation(op.id, { entryPrice: event.target.value })}
                    />
                  </label>
                  <label className="auth-field">
                    <span className="eyebrow">Stop loss</span>
                    <input
                      type="number"
                      step="any"
                      value={op.stopLoss}
                      onChange={(event) => updateOperation(op.id, { stopLoss: event.target.value })}
                    />
                  </label>
                  <label className="auth-field">
                    <span className="eyebrow">Take profit</span>
                    <input
                      type="number"
                      step="any"
                      value={op.takeProfit}
                      onChange={(event) => updateOperation(op.id, { takeProfit: event.target.value })}
                    />
                  </label>
                </div>

                <div className="field-grid-2">
                  <label className="auth-field">
                    <span className="eyebrow">Riesgo/beneficio</span>
                    <input
                      type="text"
                      value={op.riskReward}
                      onChange={(event) => updateOperation(op.id, { riskReward: event.target.value })}
                      placeholder="1:2"
                    />
                  </label>
                  <label className="auth-field">
                    <span className="eyebrow">
                      P&L
                      {op.isAutoSynced && (
                        <span className="sync-badge inline">Sincronizado · {op.brokerSource}</span>
                      )}
                    </span>
                    <input
                      type="number"
                      step="any"
                      value={op.pnl}
                      onChange={(event) => updateOperation(op.id, { pnl: event.target.value })}
                      disabled={op.isAutoSynced}
                    />
                  </label>
                </div>

                <div className="pill-field">
                  <span className="eyebrow">Resultado</span>
                  <div className="pill-row">
                    {(['TP', 'SL', 'BE'] as const).map((outcome) => (
                      <button
                        key={outcome}
                        type="button"
                        className={`pill-btn ${
                          outcome === 'TP' ? 'long' : outcome === 'SL' ? 'short' : 'gold'
                        } small ${op.outcome === outcome ? 'active' : ''}`}
                        onClick={() => updateOperation(op.id, { outcome })}
                      >
                        {outcome}
                      </button>
                    ))}
                  </div>
                </div>

                <label className="auth-field">
                  <span className="eyebrow">Lección</span>
                  <textarea
                    onInput={autoGrow}
                    value={op.lesson}
                    onChange={(event) => updateOperation(op.id, { lesson: event.target.value })}
                    placeholder="¿Qué aprendiste de esta operación?"
                    rows={3}
                  />
                </label>

                <div className="section-header">
                  <span className="eyebrow">Capturas de la operación</span>
                  <span className="hint-text">
                    {op.screenshots.length}/10 · Obligatorio para sellar
                  </span>
                </div>

                <div
                  className="screenshot-dropzone"
                  onPaste={(event) => handleOperationPaste(op.id, event)}
                  tabIndex={0}
                >
                  <label className="screenshot-upload-label">
                    {uploadingOpId === op.id
                      ? 'Subiendo…'
                      : `Agregar capturas (${10 - op.screenshots.length} restantes)`}
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={(event) => handleOperationFileInput(op.id, event)}
                      disabled={op.screenshots.length >= 10 || uploadingOpId === op.id}
                      hidden
                    />
                  </label>
                  <p className="hint-text">o presiona Ctrl+V para pegar una captura copiada</p>
                </div>

                {op.screenshots.length > 0 && (
                  <div className="screenshot-grid">
                    {op.screenshots.map((shot) => (
                      <div className="screenshot-thumb" key={shot.path}>
                        <img src={shot.url} alt="Captura de la operación" />
                        <button
                          type="button"
                          className="icon-btn"
                          onClick={() => handleRemoveOperationScreenshot(op.id, shot.path)}
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <label className="checkbox-field">
                  <input
                    type="checkbox"
                    checked={op.brokePlan}
                    onChange={(event) => updateOperation(op.id, { brokePlan: event.target.checked })}
                  />
                  No respeté mi plan en esta operación
                </label>
              </div>
            ))}
          </div>
        </section>
        )}
        </fieldset>

        {!phase2Sealed ? (
          <div className="journal-submit-row">
            <button
              type="button"
              className="primary-btn btn-sm"
              disabled={!phase2Valid || sealingPhase2}
              onClick={handleSealPhase2}
            >
              {sealingPhase2 ? 'Sellando…' : 'Sellar Ejecución'}
            </button>
            {savedAt && <span className="save-status saved">Guardado</span>}
          </div>
        ) : (
          <p className="phase-sealed-note">
            🔒 Fase 2 sellada el {new Date(entry.custom_fields.phase2_sealed_at as string).toLocaleString('es-ES')}
          </p>
        )}
        </>
        )}

        <p className="phase-label">Fase 3 · Post-mercado</p>

        {!phase2Sealed ? (
          <PhaseLocked title="Post-mercado bloqueado" message="Se desbloquea cuando sellas la Ejecución de la Fase 2." />
        ) : (
        <>
        <fieldset className="phase-fieldset" disabled={fullySealed}>
        <section className="panel plan-section je-section">
          <h3>Análisis técnico post-mercado</h3>
          <p className="hint-text">¿Qué hizo el mercado después de tu sesión? ¿Se cumplió tu lectura?</p>
          <textarea
            onInput={autoGrow}
            value={entry.post_market_analysis ?? ''}
            onChange={(event) => setEntryField('post_market_analysis', event.target.value)}
            placeholder="Describe lo que hizo el mercado después de que terminaste de operar…"
            rows={4}
          />
        </section>

        <section className="panel plan-section je-section">
          <h3>Quiz Post-Mercado</h3>
          <p className="hint-text">
            Audita tu ejecución del día. Con el tiempo, tus respuestas semanales ayudan a detectar patrones
            que se repiten.
          </p>

          {postMarketQuizQuestions.map((question) => (
            <QuizQuestionRow
              key={question.key}
              label={question.label}
              options={question.options}
              value={entry.custom_fields.quiz[question.key] ?? { answer: null, note: '' }}
              onChange={(next) =>
                setEntry((current) => ({
                  ...current,
                  custom_fields: {
                    ...current.custom_fields,
                    quiz: { ...current.custom_fields.quiz, [question.key]: next },
                  },
                }))
              }
            />
          ))}

          <div className="pill-field">
            <span className="eyebrow">Emoción predominante/s</span>
            <div className="pill-row">
              {psychologyEmotions.map((emotion) => (
                <button
                  key={emotion}
                  type="button"
                  className={`pill-btn gold small ${
                    entry.custom_fields.psychology_emotions.includes(emotion) ? 'active' : ''
                  }`}
                  onClick={() => toggleEmotion(emotion)}
                >
                  {emotion}
                </button>
              ))}
            </div>
          </div>

          <label className="auth-field">
            <span className="eyebrow">Algo más que quieras agregar</span>
            <textarea
              onInput={autoGrow}
              value={entry.custom_fields.quiz_extra_notes}
              onChange={(event) => setCustomField('quiz_extra_notes', event.target.value)}
              placeholder="Cualquier otra cosa que quieras recordar de hoy…"
              rows={3}
            />
          </label>
        </section>

        <section className="panel plan-section je-section">
          <AtaraxiaBar score={disciplineResult.score} delta={areteDelta} />
          {areteFlowStreakActive && (
            <p className="synergy-chip flow">
              ⚡ Racha de Flujo activa — tus puntos Virtus positivos de hoy suman +20%.
            </p>
          )}
          {areteTiltActive && (
            <p className="synergy-chip tilt">
              ⚠ Zona de Tilt — tus penalizaciones Virtus de hoy se multiplican ×1.5.
            </p>
          )}
          {disciplineResult.score !== null && (
            <div className="arete-breakdown">
              {disciplineResult.positives.length > 0 && (
                <div className="arete-col">
                  <span className="eyebrow">Lo que sumó</span>
                  <ul>
                    {disciplineResult.positives.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              )}
              {disciplineResult.negatives.length > 0 && (
                <div className="arete-col">
                  <span className="eyebrow">Lo que restó</span>
                  <ul>
                    {disciplineResult.negatives.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </section>
        </fieldset>

        {fullySealed && (
          <p className="phase-sealed-note">
            🔒 Registro sellado el {new Date(entry.custom_fields.sealed_at as string).toLocaleString('es-ES')} — ya
            no se puede editar.
          </p>
        )}

        {error && <p className="auth-message error">{error}</p>}

        <div className="journal-submit-row">
          <button
            type="submit"
            className={`primary-btn drawer-submit ${phase3Valid && !fullySealed ? 'seal-ready' : ''}`}
            disabled={!phase3Valid || fullySealed || submitting}
          >
            {submitting ? 'Sellando…' : fullySealed ? 'Registro sellado' : 'Sellar Registro'}
          </button>
          <button type="button" className="ghost-btn btn-sm" onClick={handleDownload} disabled={downloading}>
            {downloading ? 'Descargando…' : 'Descargar journal'}
          </button>
          {savedAt && <span className="save-status saved">Guardado</span>}
          <Link to="/dashboard" className="ghost-btn btn-sm">
            Volver a Inicio
          </Link>
        </div>
        </>
        )}
      </form>

      <SessionSealedModal
        open={showSealedSummary}
        onClose={() => setShowSealedSummary(false)}
        score={disciplineResult.score}
        positives={disciplineResult.positives}
        negatives={disciplineResult.negatives}
        omegaAuditing={auditingSession}
        omegaVerdict={omegaLastEffects?.sessionVerdict ?? null}
        omegaError={auditingSession ? null : omegaError}
      />

      <JournalInfoModal open={infoOpen} onClose={() => setInfoOpen(false)} />
    </>
  );
}

export default JournalEntry;
