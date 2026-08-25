import { useCallback, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { readFunctionErrorMessage } from '../lib/functionsError';
import { supabase } from '../lib/supabaseClient';
import {
  getJournalEntryByDate,
  getLatestSessionVerdict,
  getOperations,
  getTradingPlan,
  getVirtusDelta,
  getVirtusTotal,
  type AiSessionVerdict,
  type JournalEntryFull,
  type OperationItem,
  type TradingPlan,
} from '../lib/api';
import { localIsoDate } from '../lib/calendar';
import { computeDisciplineScore } from '../lib/disciplineScore';
import { currentStage } from '../lib/virtus';

export type OmegaMessage = { role: 'user' | 'assistant'; content: string };

export type ActiveAlert = { id: string; message: string; severity: 'info' | 'warning' | 'critical' };

export type OmegaEffects = {
  virtusDelta: number;
  missionsAssigned: { title: string; reward_xp: number }[];
  uiAlerts: { message: string; severity: 'info' | 'warning' | 'critical' }[];
  streakValidations: { description: string; bonus_xp: number }[];
  sessionVerdict: { ataraxia_score: number | null; verdict: string; went_well: string[]; went_wrong: string[] } | null;
};

type OmegaRequestType = 'chat' | 'briefing_pre_sesion' | 'auditoria_post_sesion';

type OmegaResponse = { ok: true; reply: string; effects: OmegaEffects } | { ok: false; error: string };

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
): string {
  const goalsLines = plan?.goals?.length ? plan.goals.map((g) => `- ${g.text}`).join('\n') : '(sin metas definidas)';

  const verdictBlock = latestVerdict
    ? `Último veredicto guardado (${latestVerdict.session_date}${latestVerdict.ataraxia_score !== null ? `, Ataraxia ${latestVerdict.ataraxia_score}%` : ''}):
- Se hizo bien: ${latestVerdict.went_well.join('; ') || '—'}
- Se hizo mal: ${latestVerdict.went_wrong.join('; ') || '—'}`
    : 'Sin veredicto de sesión anterior guardado todavía.';

  return `BRIEFING PRE-SESIÓN — reglas del Manual Operativo para hoy:

Horario operativo: ${plan?.schedule_start || '—'} a ${plan?.schedule_end || '—'}
Trades permitidos por sesión: ${plan?.max_trades_per_session || '(no definido)'}
Días sin operar: ${plan?.no_trade_days || '(no definidos)'}
Gestión de riesgo: ${plan?.risk_management || '(no definida)'}
Reglas psicológicas: ${plan?.psychological_rules || '(no definidas)'}

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
      },
    ) => {
      if (!user) return;
      setMessages(nextMessages);
      setSending(true);
      setError(null);

      try {
        const virtusTotal = await getVirtusTotal(user.id);
        const stage = currentStage(virtusTotal);

        const { data, error: invokeError } = await supabase.functions.invoke('omega-coach', {
          body: {
            messages: nextMessages,
            context: { virtusStage: stage.level, virtusTotal, ...contextExtra },
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
        await invokeOmega([...messages, { role: 'user', content: `Evalúa mi sesión del ${targetDate}.` }], {
          ataraxiaPct: score,
          sessionDigest: digest,
          requestType: 'auditoria_post_sesion',
          sessionDate: targetDate,
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
      const digest = buildBriefingDigest(plan, virtusDelta7d, latestVerdict);
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

  return { messages, sending, error, lastEffects, uiAlerts, dismissAlert, sendMessage, evaluateSession, requestBriefing };
}
