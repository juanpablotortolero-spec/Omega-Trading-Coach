import { useEffect, useRef, useState } from 'react';
import BriefingHistoryCalendar from '../components/BriefingHistoryCalendar';
import BriefingPreSesion from '../components/BriefingPreSesion';
import MonthlyCloseModal from '../components/MonthlyCloseModal';
import OmegaMark from '../components/OmegaMark';
import PsychoProfileCard from '../components/PsychoProfileCard';
import TendlerGameMeter from '../components/TendlerGameMeter';
import WeeklyRecapModal from '../components/WeeklyRecapModal';
import { useAuth } from '../contexts/AuthContext';
import { useOmega } from '../contexts/OmegaContext';
import { useRefresh } from '../contexts/RefreshContext';
import type { HeadCoachAudit, MonthlyCloseResult, WeeklyRecapResult } from '../hooks/useOmegaAgent';
import {
  acknowledgeBriefing,
  getAiMissions,
  getJournalEntryByDate,
  getLatestGoalProgressReasons,
  getTodayBriefingAckStatus,
  getTodayOmegaAudit,
  getTodayVirtusEventReasons,
  getTradingPlan,
  type AiMission,
  type GoalItem,
  type VirtusEventReason,
} from '../lib/api';
import { localIsoDate } from '../lib/calendar';

type CoachTab = 'briefing' | 'estado' | 'conversacion' | 'objetivos';

const TABS: { key: CoachTab; label: string }[] = [
  { key: 'briefing', label: 'Briefing Pre-Sesión' },
  { key: 'estado', label: 'Estado' },
  { key: 'conversacion', label: 'Conversación' },
  { key: 'objetivos', label: 'Objetivos' },
];

function formatProfileItems(items: HeadCoachAudit['strengths'] | HeadCoachAudit['weaknesses']): string[] {
  return items.map((item) => (item.fix ? `${item.behavior} — ${item.fix}` : item.behavior));
}

/**
 * Estado/Conversación/Objetivos ya no tienen contenido de relleno cuando
 * todavía no hay auditoría real — muestran esto en su lugar hasta que el
 * trader sella su journal del día (lo que dispara la auditoría automática,
 * ver JournalEntry.tsx).
 */
function WaitingForSealPanel() {
  return (
    <div className="panel empty-state">
      <span className="empty-icon" />
      <h3>Esperando el cierre de tu sesión</h3>
      <p>Esta información estará disponible una vez selles por completo tu journal de hoy.</p>
    </div>
  );
}

function OmegaDashboard() {
  const { user } = useAuth();
  const { sending, requestWeeklyRecap, requestMonthlyClose } = useOmega();
  const { version, bump } = useRefresh();
  const todayIso = localIsoDate(new Date());

  const [activeTab, setActiveTab] = useState<CoachTab>('briefing');

  const [audit, setAudit] = useState<HeadCoachAudit | null>(null);
  const [todaySealed, setTodaySealed] = useState(false);

  const [recapResult, setRecapResult] = useState<WeeklyRecapResult | null>(null);
  const [recapOpen, setRecapOpen] = useState(false);
  const [generatingWeekKey, setGeneratingWeekKey] = useState<string | null>(null);
  const [recapError, setRecapError] = useState<string | null>(null);

  const [monthlyResult, setMonthlyResult] = useState<MonthlyCloseResult | null>(null);
  const [monthlyOpen, setMonthlyOpen] = useState(false);
  const [monthlyLoading, setMonthlyLoading] = useState(false);
  const [monthlyError, setMonthlyError] = useState<string | null>(null);

  const [briefingAck, setBriefingAck] = useState<{ exists: boolean; acknowledged: boolean }>({
    exists: false,
    acknowledged: false,
  });
  const [acknowledging, setAcknowledging] = useState(false);

  const [aiMissions, setAiMissions] = useState<AiMission[]>([]);
  const [goals, setGoals] = useState<GoalItem[]>([]);
  const [goalReasons, setGoalReasons] = useState<Map<string, { reason: string; delta: number; createdAt: string }>>(
    new Map(),
  );

  const [virtusReasons, setVirtusReasons] = useState<{ positive: VirtusEventReason[]; negative: VirtusEventReason[] }>({
    positive: [],
    negative: [],
  });

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    getTodayOmegaAudit(user.id, todayIso).then((row) => {
      if (cancelled || !row) return;
      setAudit({
        game_state: row.game_state,
        daily_feedback: row.daily_feedback,
        strengths: row.strengths,
        weaknesses: row.weaknesses,
        daily_missions: row.daily_missions,
        manual_audit: row.manual_audit,
      });
    });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, version]);

  // Estado/Conversación/Objetivos se destraban recién cuando HOY quedó
  // sellado — la auditoría automática (disparada al sellar, ver
  // JournalEntry.tsx) alimenta `audit` arriba, pero el sello en sí es la
  // señal real: si la auditoría todavía no terminó, igual queremos mostrar
  // "ya sellaste, esperando el análisis" en vez de "todavía te falta sellar".
  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    getJournalEntryByDate(user.id, todayIso).then((entry) => {
      if (!cancelled) setTodaySealed(Boolean(entry?.custom_fields.sealed_at));
    });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, version]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    Promise.all([getAiMissions(user.id), getTradingPlan(user.id), getLatestGoalProgressReasons(user.id)]).then(
      ([missions, plan, reasons]) => {
        if (cancelled) return;
        setAiMissions(missions);
        setGoals(plan?.goals ?? []);
        setGoalReasons(reasons);
      },
    );

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    getTodayVirtusEventReasons(user.id, todayIso).then((reasons) => {
      if (!cancelled) setVirtusReasons(reasons);
    });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Se refresca cada vez que un pedido a Omega termina (generar el briefing
  // incluido) — es la única forma de saber, sin acoplar este componente a
  // BriefingPreSesion, que la fila en omega_briefings ya existe. La primera
  // vez que detecta un briefing sin leer, bump() para que el poll de
  // MainLayout (atado a `version`, no a este efecto) reaccione y encienda el
  // glow del sidebar ya mismo, sin esperar a la próxima navegación —
  // guardado en un ref, no en cada corrida, para no disparar refetch en
  // cascada por toda la app cada vez que este efecto vuelve a correr.
  const unreadBriefingNotifiedRef = useRef(false);

  useEffect(() => {
    if (!user || sending) return;
    let cancelled = false;

    getTodayBriefingAckStatus(user.id, todayIso).then((status) => {
      if (cancelled) return;
      setBriefingAck(status);
      if (status.exists && !status.acknowledged) {
        if (!unreadBriefingNotifiedRef.current) {
          unreadBriefingNotifiedRef.current = true;
          bump();
        }
      } else {
        unreadBriefingNotifiedRef.current = false;
      }
    });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, sending]);

  const handleGenerateRecap = async (weekMonday: Date) => {
    if (generatingWeekKey) return;
    setGeneratingWeekKey(localIsoDate(weekMonday));
    setRecapError(null);
    try {
      const result = await requestWeeklyRecap(weekMonday);
      setRecapResult(result);
      setRecapOpen(true);
    } catch (err) {
      setRecapError(err instanceof Error ? err.message : 'No se pudo generar la Auditoría Semanal.');
    } finally {
      setGeneratingWeekKey(null);
    }
  };

  const handleGenerateMonthlyClose = async (monthStart: string, monthEnd: string) => {
    if (monthlyLoading) return;
    setMonthlyLoading(true);
    setMonthlyError(null);
    try {
      const result = await requestMonthlyClose(monthStart, monthEnd);
      setMonthlyResult(result);
      setMonthlyOpen(true);
    } catch (err) {
      setMonthlyError(err instanceof Error ? err.message : 'No se pudo generar la Auditoría Mensual.');
    } finally {
      setMonthlyLoading(false);
    }
  };

  const handleAcknowledgeBriefing = async () => {
    if (!user || acknowledging) return;
    setAcknowledging(true);
    try {
      await acknowledgeBriefing(user.id, todayIso);
      setBriefingAck((current) => ({ ...current, acknowledged: true }));
      bump();
    } catch {
      // Silencioso: si falla, el botón sigue visible y el trader puede reintentar.
    } finally {
      setAcknowledging(false);
    }
  };

  const strengths = audit ? formatProfileItems(audit.strengths) : [];
  const weaknesses = audit ? formatProfileItems(audit.weaknesses) : [];
  const feedbackText = audit?.daily_feedback ?? '';
  const gameLevel = audit?.game_state ?? 'B';
  const auditText = audit
    ? `${audit.manual_audit.issue_detected ? `${audit.manual_audit.issue_detected} ` : ''}${audit.manual_audit.suggested_rule}`.trim()
    : '';

  const incompleteMissions = aiMissions.filter((mission) => !mission.completed);
  const namedGoals = goals.filter((goal) => goal.text.trim().length > 0);
  const automaticGoals = namedGoals.filter((goal) => goal.type === 'automatic');

  return (
    <div className="omega-hq">
      <header className="omega-hq-header">
        <OmegaMark size={40} />
        <div className="omega-hq-header-copy">
          <h2>Omega — Head Coach</h2>
          <p className="hint-text">Tu centro de mando dedicado a Omega.</p>
        </div>
      </header>

      <WeeklyRecapModal open={recapOpen} onClose={() => setRecapOpen(false)} result={recapResult} />
      <MonthlyCloseModal open={monthlyOpen} onClose={() => setMonthlyOpen(false)} result={monthlyResult} />

      <div className="plan-tabs">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            className={`plan-tab ${activeTab === tab.key ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
            {tab.key !== 'briefing' && todaySealed && <span className="nav-notif-dot" title="Análisis del día listo" />}
          </button>
        ))}
      </div>

      {activeTab === 'briefing' && (
        <div className="omega-tab-panel">
          <h3 className="omega-briefing-title">Briefing Pre-Sesión</h3>
          <BriefingPreSesion />

          {briefingAck.exists && !briefingAck.acknowledged && (
            <button type="button" className="primary-btn btn-sm" onClick={handleAcknowledgeBriefing} disabled={acknowledging}>
              {acknowledging ? 'Guardando…' : 'He leído el briefing y acepto el plan de acción de hoy'}
            </button>
          )}
          {briefingAck.exists && briefingAck.acknowledged && (
            <p className="hint-text">✓ Plan de acción de hoy aceptado.</p>
          )}

          <section className="panel plan-section omega-briefing-history">
            <p className="hint-text">
              El botón de cada semana genera su Auditoría Semanal — se habilita al cerrar esa semana (viernes post-sesión en adelante).
            </p>
            {recapError && <p className="omega-chat-error">{recapError}</p>}
            {monthlyError && <p className="omega-chat-error">{monthlyError}</p>}
            {user && (
              <BriefingHistoryCalendar
                userId={user.id}
                onGenerateWeeklyAudit={handleGenerateRecap}
                generatingWeekKey={generatingWeekKey}
                onGenerateMonthlyClose={handleGenerateMonthlyClose}
                monthlyGenerating={monthlyLoading}
              />
            )}
          </section>
        </div>
      )}

      {activeTab === 'estado' && !todaySealed && (
        <div className="omega-tab-panel">
          <WaitingForSealPanel />
        </div>
      )}

      {activeTab === 'estado' && todaySealed && (
        <div className="omega-tab-panel">
          <section className="panel plan-section omega-hq-col-status">
            <h3 className="omega-section-title">Estado</h3>
            <TendlerGameMeter level={gameLevel} />
          </section>

          <section className="panel plan-section">
            <h3 className="omega-section-title">Qué sumó / Qué restó — hoy</h3>
            <div className="virtus-reasons-grid">
              <div className="virtus-reasons-col positive">
                <div className="virtus-reasons-col-header">
                  <span className="psycho-card-dot" aria-hidden="true" />
                  <h4>Qué sumó</h4>
                </div>
                {virtusReasons.positive.length === 0 ? (
                  <p className="hint-text">Sin eventos positivos registrados hoy todavía.</p>
                ) : (
                  <ul className="virtus-reasons-list">
                    {virtusReasons.positive.map((event, index) => (
                      <li key={index}>
                        <span>{event.reason}</span>
                        <span className="virtus-reasons-points positive">+{event.points}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="virtus-reasons-col negative">
                <div className="virtus-reasons-col-header">
                  <span className="psycho-card-dot" aria-hidden="true" />
                  <h4>Qué restó</h4>
                </div>
                {virtusReasons.negative.length === 0 ? (
                  <p className="hint-text">Sin eventos negativos registrados hoy todavía.</p>
                ) : (
                  <ul className="virtus-reasons-list">
                    {virtusReasons.negative.map((event, index) => (
                      <li key={index}>
                        <span>{event.reason}</span>
                        <span className="virtus-reasons-points negative">{event.points}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </section>
        </div>
      )}

      {activeTab === 'conversacion' && !todaySealed && (
        <div className="omega-tab-panel">
          <WaitingForSealPanel />
        </div>
      )}

      {activeTab === 'conversacion' && todaySealed && (
        <div className="omega-tab-panel">
          <section className="panel plan-section">
            <h3 className="omega-section-title">Conversación</h3>
            <div className="omega-feedback-box">
              <div className="omega-feedback-eyebrow">
                <OmegaMark size={22} />
                <span className="eyebrow">Feedback de Omega — última sesión</span>
              </div>
              <p className="omega-feedback-text">{feedbackText}</p>
            </div>
          </section>

          <div className="omega-conversation-psycho">
            <PsychoProfileCard variant="strength" title="Fortalezas" items={strengths} />
            <PsychoProfileCard variant="leak" title="Fugas de Capital" items={weaknesses} />
          </div>
        </div>
      )}

      {activeTab === 'objetivos' && !todaySealed && (
        <div className="omega-tab-panel">
          <WaitingForSealPanel />
        </div>
      )}

      {activeTab === 'objetivos' && todaySealed && (
        <div className="omega-tab-panel">
          <section className="panel plan-section">
            <div className="section-header">
              <h3 className="omega-section-title">Centro de Misiones Activas</h3>
              <span className="omega-assigned-tag">asignadas por Omega</span>
            </div>
            {incompleteMissions.length === 0 ? (
              <div className="empty-state">
                <span className="empty-icon" />
                <h3>Sin misiones activas</h3>
                <p>Cuando Omega detecte un patrón, te asignará una misión aquí.</p>
              </div>
            ) : (
              <div className="omega-mission-list">
                {incompleteMissions.map((mission) => (
                  <div key={mission.id} className="omega-mission-card">
                    <div className="omega-mission-copy">
                      <strong>{mission.title}</strong>
                      <p className="hint-text">{mission.description}</p>
                      <div className="omega-mission-meta">
                        <span className="nav-soon">{mission.frequency}</span>
                        <span className="hint-text">+{mission.reward_xp} XP</span>
                      </div>
                      <div className="gauge-wrap omega-mission-progress">
                        <span className="gauge-fill" style={{ width: `${mission.progress_pct}%` }} />
                      </div>
                      <p className="hint-text">Omega verifica tu progreso real: {mission.progress_pct}%</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="panel plan-section">
            <h3 className="omega-section-title">Metas del Manual Operativo</h3>
            {automaticGoals.length === 0 ? (
              <p className="hint-text">Sin metas automáticas definidas todavía.</p>
            ) : (
              <div className="goal-list">
                {automaticGoals.map((goal) => (
                  <div className="goal-row" key={goal.id}>
                    <div className="goal-row-header">
                      <span className="goal-name">
                        {goal.text || 'Meta sin nombre'}
                        <span className="goal-tag auto">
                          <span className="goal-tag-dot" />
                          Automática
                        </span>
                      </span>
                      <span className="mission-meta">{goal.progressPct}%</span>
                    </div>
                    <div className="gauge-wrap">
                      <span className="gauge-fill" style={{ width: `${goal.progressPct}%` }} />
                    </div>
                    <p className="hint-text">
                      {goalReasons.has(goal.id)
                        ? `Omega: ${goalReasons.get(goal.id)!.reason} (${goalReasons.get(goal.id)!.delta > 0 ? '+' : ''}${goalReasons.get(goal.id)!.delta}%)`
                        : 'Omega ajusta este progreso según tu ejecución real.'}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </section>

          <div className="manual-audit-alert">
            <div className="manual-audit-alert-header">
              <span className="manual-audit-alert-icon" aria-hidden="true">
                ⚠
              </span>
              <span className="eyebrow">Alerta de Auditoría del Manual</span>
            </div>
            <p className="manual-audit-alert-text">{auditText}</p>
          </div>
        </div>
      )}
    </div>
  );
}

export default OmegaDashboard;
