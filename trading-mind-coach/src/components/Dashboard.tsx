import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import MonthCalendar from './MonthCalendar';
import VirtusIcon, { type VirtusLevel } from './VirtusIcon';
import VirtusProgressBar from './VirtusProgressBar';
import { useAuth } from '../contexts/AuthContext';
import { useRefresh } from '../contexts/RefreshContext';
import {
  awardWeeklyMissions,
  getAiMissions,
  getAllOperations,
  getCompletedWeeklyMissionKeys,
  getDisciplineInputsByDate,
  getFriends,
  getMyAgoras,
  getMyProfile,
  getOperationsInRange,
  getPendingAgoraRequestsCount,
  getPendingFriendRequestsCount,
  getRecentEntrySealStatus,
  getRecentSharesForMe,
  getStatsPreview,
  getStreak,
  getTodaySessionVirtusDelta,
  getTodayStatus,
  getTradingPlan,
  getVirtusPeak,
  getVirtusTotal,
  getWeekBounds,
  getWeeklyMissionsStatus,
  updateAiMissionCompleted,
  weeklyMissionDefinitions,
  type Agora,
  type AiMission,
  type Friend,
  type GoalItem,
  type SharedEntry,
  type StatsPreview,
  type StatsRange,
  type TodayStatus,
  type WeeklyMissionsStatus,
} from '../lib/api';
import { dateKey, localIsoDate, summarizeOperationsByDate, type DaySummary } from '../lib/calendar';
import { computeDisciplineTimeline, type DisciplineOperationInput } from '../lib/disciplineScore';
import { isOnline } from '../lib/presence';
import { currentStage, stageBadges } from '../lib/virtus';
import AtaraxiaBar from './AtaraxiaBar';
import OraculoMatutino from './OraculoMatutino';
import ProgressInfoModal from './ProgressInfoModal';
import UserEmblem from './UserEmblem';

const statsRangeOptions: { value: StatsRange; label: string }[] = [
  { value: 'day', label: 'Día' },
  { value: 'week', label: 'Semana' },
  { value: 'month', label: 'Mes' },
  { value: 'year', label: 'Año' },
  { value: 'all', label: 'General' },
];

const statsRangeLabels: Record<StatsRange, string> = {
  day: 'Hoy',
  week: 'Semanal',
  month: 'Mensual',
  year: 'Anual',
  all: 'General',
};

function LaurelBranch({ mirrored }: { mirrored?: boolean }) {
  return (
    <svg
      className="streak-laurel"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.3"
      strokeLinecap="round"
      aria-hidden="true"
      style={mirrored ? { transform: 'scaleX(-1)' } : undefined}
    >
      <path d="M4 20c1-7 5-12 12-15" />
      <path d="M7 17c1-5 4-9 9-11" />
      <path d="M10 14c1-3 3-6 6-8" />
    </svg>
  );
}

function Dashboard() {
  const { user } = useAuth();
  const { version } = useRefresh();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [streak, setStreak] = useState(0);
  const [todayStatus, setTodayStatus] = useState<TodayStatus>({
    hasEntry: false,
    emotionalStateSet: false,
    operationsCount: 0,
    directrizSet: false,
    quizCompleted: false,
  });
  const [stats, setStats] = useState<StatsPreview>({ operationsCount: 0, winRatePct: null, pnl: 0 });
  const [statsRange, setStatsRange] = useState<StatsRange>('week');
  const [statsFilterOpen, setStatsFilterOpen] = useState(false);
  const [summaryByDate, setSummaryByDate] = useState<Record<string, DaySummary>>({});
  const [weeklyStatus, setWeeklyStatus] = useState<WeeklyMissionsStatus>({ daysWithEntry: 0, cleanWeek: false });
  const [completedWeeklyKeys, setCompletedWeeklyKeys] = useState<Set<string>>(new Set());
  const [virtusTotal, setVirtusTotal] = useState(0);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [pendingAgoraCount, setPendingAgoraCount] = useState(0);
  const [shares, setShares] = useState<SharedEntry[]>([]);
  const [goals, setGoals] = useState<GoalItem[]>([]);
  const [profileDisplayName, setProfileDisplayName] = useState<string | null>(null);
  const [agoras, setAgoras] = useState<Agora[]>([]);
  const [todayDelta, setTodayDelta] = useState(0);
  const [peakTotal, setPeakTotal] = useState(0);
  const [areteTotal, setAreteTotal] = useState<number | null>(null);
  const [areteDelta, setAreteDelta] = useState<number | null>(null);
  const [infoOpen, setInfoOpen] = useState(false);
  const [hasUnsealedReminder, setHasUnsealedReminder] = useState(false);
  const [aiMissions, setAiMissions] = useState<AiMission[]>([]);

  const today = new Date();
  const todayIso = localIsoDate(today);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const monthStart = dateKey(today.getFullYear(), today.getMonth(), 1);
        const monthLastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
        const monthEnd = dateKey(today.getFullYear(), today.getMonth(), monthLastDay);
        const { weekStart, weekEnd } = getWeekBounds(today);

        const plan = await getTradingPlan(user!.id);
        if (cancelled) return;

        const [
          streakVal,
          status,
          ops,
          weekly,
          friendList,
          pending,
          pendingAgora,
          sharesList,
          profile,
          agoraList,
          delta,
          disciplineInputs,
          allOps,
          sealStatus,
        ] = await Promise.all([
          getStreak(user!.id, todayIso, plan?.trades_crypto ?? false),
          getTodayStatus(user!.id, todayIso),
          getOperationsInRange(user!.id, monthStart, monthEnd),
          getWeeklyMissionsStatus(user!.id, weekStart, weekEnd),
          getFriends(user!.id),
          getPendingFriendRequestsCount(user!.id),
          getPendingAgoraRequestsCount(user!.id),
          getRecentSharesForMe(user!.id),
          getMyProfile(user!.id),
          getMyAgoras(user!.id),
          getTodaySessionVirtusDelta(user!.id, todayIso),
          getDisciplineInputsByDate(user!.id),
          getAllOperations(user!.id),
          getRecentEntrySealStatus(user!.id, todayIso),
        ]);

        if (cancelled) return;

        await awardWeeklyMissions(user!.id, weekStart, weekly);
        const [completedKeys, total] = await Promise.all([
          getCompletedWeeklyMissionKeys(user!.id, weekStart),
          getVirtusTotal(user!.id),
        ]);

        if (cancelled) return;

        const peak = await getVirtusPeak(user!.id, total);
        if (cancelled) return;

        setStreak(streakVal);
        setTodayStatus(status);
        setSummaryByDate(summarizeOperationsByDate(ops));
        setWeeklyStatus(weekly);
        setCompletedWeeklyKeys(completedKeys);
        setVirtusTotal(total);
        setFriends(friendList);
        setPendingCount(pending);
        setPendingAgoraCount(pendingAgora);
        setShares(sharesList);
        setHasUnsealedReminder(Boolean(sealStatus && !sealStatus.sealed));
        setGoals(plan?.goals ?? []);
        setProfileDisplayName(profile.displayName);
        setAgoras(agoraList);
        setTodayDelta(delta);
        setPeakTotal(peak);

        const opsByDate = new Map<string, DisciplineOperationInput[]>();
        allOps.forEach((op) => {
          const list = opsByDate.get(op.entry_date) ?? [];
          list.push({ model: op.model, session: op.session, brokePlan: op.broke_plan });
          opsByDate.set(op.entry_date, list);
        });
        const timeline = computeDisciplineTimeline(disciplineInputs, opsByDate, plan?.max_trades_per_session ?? null);
        if (timeline.length === 0) {
          setAreteTotal(null);
          setAreteDelta(null);
        } else {
          const average = Math.round(timeline.reduce((sum, day) => sum + day.score, 0) / timeline.length);
          setAreteTotal(average);
          const withoutLatest = timeline.slice(0, -1);
          setAreteDelta(
            withoutLatest.length === 0
              ? null
              : average - Math.round(withoutLatest.reduce((sum, day) => sum + day.score, 0) / withoutLatest.length),
          );
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Error desconocido');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, version]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    getStatsPreview(user.id, statsRange).then((val) => {
      if (!cancelled) setStats(val);
    });

    return () => {
      cancelled = true;
    };
  }, [user, version, statsRange]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    getAiMissions(user.id).then((list) => {
      if (!cancelled) setAiMissions(list);
    });

    return () => {
      cancelled = true;
    };
  }, [user, version]);

  const toggleAiMission = async (mission: AiMission) => {
    const nextCompleted = !mission.completed;
    setAiMissions((current) =>
      current.map((m) => (m.id === mission.id ? { ...m, completed: nextCompleted } : m)),
    );
    try {
      await updateAiMissionCompleted(mission.id, nextCompleted);
    } catch {
      setAiMissions((current) =>
        current.map((m) => (m.id === mission.id ? { ...m, completed: mission.completed } : m)),
      );
    }
  };

  const stage = currentStage(virtusTotal);
  const namedGoals = goals.filter((goal) => goal.text.trim().length > 0);
  const displayName = profileDisplayName || user?.email?.split('@')[0] || '';
  const dateLabel = today.toLocaleDateString('es-ES', { weekday: 'long', day: '2-digit', month: 'long' });
  const monthLabel = today.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
  const todayKey = dateKey(today.getFullYear(), today.getMonth(), today.getDate());
  const mailboxCount = pendingCount + pendingAgoraCount + shares.length + (hasUnsealedReminder ? 1 : 0);

  return (
    <>
      <OraculoMatutino />
      <div className="inicio-grid">
      <div className="inicio-main">
        <header className="topbar panel inicio-header">
          <div>
            <h2>{dateLabel}</h2>
            <p className="inicio-greeting">
              Hola, <span className="inicio-greeting-name">{displayName}</span>
            </p>
          </div>
          {streak > 0 && (
            <span className="streak-badge">
              <span className="streak-badge-medal">
                <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M16 5c2.6 3.4-0.8 5.6-0.8 8.4a3.6 3.6 0 007.2 0c0-1.8-0.9-2.7-0.9-2.7 1.8 1.8 2.7 4.4 2.7 7.1a9 9 0 11-18 0c0-5.6 3.6-8.3 5.4-10.1 0.9-0.9 1.8-1.8 2.7-2.7z" />
                </svg>
              </span>
              <span className="streak-badge-info">
                <LaurelBranch />
                <strong className="streak-badge-count">{streak}</strong>
                <LaurelBranch mirrored />
              </span>
              <span className="streak-badge-label">día{streak === 1 ? '' : 's'} de racha</span>
            </span>
          )}
        </header>

        {error && <div className="panel error-banner">No se pudieron cargar los datos: {error}</div>}

        <section className="panel session-status-card">
          {loading ? (
            <div className="skeleton skeleton-text" />
          ) : todayStatus.hasEntry ? (
            <>
              <div className="status-icon done">✓</div>
              <div className="session-status-copy">
                <strong>Ya registraste tu sesión de hoy</strong>
                <p className="hint-text">Directriz, contexto y operaciones del día</p>
              </div>
              <button className="ghost-btn btn-sm" onClick={() => navigate('/journal/nuevo')}>
                Editar →
              </button>
            </>
          ) : (
            <>
              <div className="status-icon pending">○</div>
              <div className="session-status-copy">
                <strong>Aún no registras tu sesión de hoy</strong>
                <p className="hint-text">Sella tu journal para mantener tu racha y ganar Virtus</p>
              </div>
              <button className="primary-btn btn-sm" onClick={() => navigate('/journal/nuevo')}>
                Registrar →
              </button>
            </>
          )}
        </section>

        <section className="panel plan-section">
          <div className="section-header">
            <h3>Misiones de hoy</h3>
            <span className="hint-text">ver todas →</span>
          </div>
          <div className="mission-list">
            <MissionRow
              label="Registra tu estado emocional de hoy"
              difficulty="FÁCIL"
              points={5}
              done={todayStatus.emotionalStateSet}
            />
            <MissionRow
              label="Define tu Directriz Operativa antes de operar"
              difficulty="FÁCIL"
              points={5}
              done={todayStatus.directrizSet}
            />
            <MissionRow
              label="Completa tu journal con al menos una operación"
              difficulty="MEDIA"
              points={10}
              done={todayStatus.operationsCount > 0}
            />
            <MissionRow
              label="Completa el Quiz Post-Mercado"
              difficulty="MEDIA"
              points={15}
              done={todayStatus.quizCompleted}
            />
          </div>
        </section>

        <section className="panel plan-section">
          <div className="section-header">
            <h3>Misiones de la semana</h3>
            <span className="hint-text">
              {weeklyStatus.daysWithEntry}/5 días registrados
            </span>
          </div>
          <div className="mission-list">
            {weeklyMissionDefinitions.map((mission) => (
              <MissionRow
                key={mission.key}
                label={mission.label}
                difficulty={mission.difficulty}
                points={mission.points}
                done={completedWeeklyKeys.has(mission.key)}
              />
            ))}
          </div>
        </section>

        <section className="panel plan-section">
          <div className="section-header">
            <h3>Centro de Misiones Activas</h3>
            <span className="hint-text">asignadas por Omega</span>
          </div>
          {aiMissions.filter((m) => !m.completed).length === 0 && aiMissions.filter((m) => m.completed).length === 0 ? (
            <div className="empty-state">
              <span className="empty-icon" />
              <h3>Sin misiones activas</h3>
              <p>Cuando Omega detecte un patrón, te asignará una misión aquí.</p>
            </div>
          ) : (
            <div className="omega-mission-list">
              {[...aiMissions]
                .sort((a, b) => Number(a.completed) - Number(b.completed))
                .map((mission) => (
                  <div key={mission.id} className={`omega-mission-card ${mission.completed ? 'completed' : ''}`}>
                    <input
                      type="checkbox"
                      className="omega-mission-checkbox"
                      checked={mission.completed}
                      onChange={() => toggleAiMission(mission)}
                      aria-label={`Marcar "${mission.title}" como completada`}
                    />
                    <div className="omega-mission-copy">
                      <strong>{mission.title}</strong>
                      <p className="hint-text">{mission.description}</p>
                      <div className="omega-mission-meta">
                        <span className="nav-soon">{mission.frequency}</span>
                        <span className="hint-text">+{mission.reward_xp} XP</span>
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </section>

        <section className="panel plan-section">
          <div className="section-header">
            <h3>Tus Metas</h3>
            <Link to="/manual-operativo" className="back-link">
              + Agregar meta
            </Link>
          </div>

          {namedGoals.length === 0 ? (
            <div className="empty-state">
              <span className="empty-icon" />
              <h3>Aún no defines metas</h3>
              <p>
                Agrega tus objetivos en el{' '}
                <Link to="/manual-operativo" className="back-link">
                  Manual Operativo
                </Link>{' '}
                para hacerles seguimiento aquí.
              </p>
            </div>
          ) : (
            <div className="goal-list">
              {namedGoals.map((goal) => (
                <div className="goal-row" key={goal.id}>
                  <div className="goal-row-header">
                    <span className="goal-name">
                      {goal.text || 'Meta sin nombre'}
                      {goal.type === 'automatic' ? (
                        <span className="goal-tag auto">
                          <span className="goal-tag-dot" />
                          Automática
                        </span>
                      ) : (
                        <span className="goal-tag manual">Manual</span>
                      )}
                    </span>
                    <span className="mission-meta">{goal.progressPct}%</span>
                  </div>
                  <div className="gauge-wrap">
                    <span className="gauge-fill" style={{ width: `${goal.progressPct}%` }} />
                  </div>
                  {goal.type === 'automatic' && (
                    <p className="hint-text">Se actualizará sola cuando actives el asistente de IA.</p>
                  )}
                  {goal.reward && <p className="hint-text">Recompensa: {goal.reward}</p>}
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="panel plan-section">
          <div className="section-header">
            <h3>Estadísticas generales</h3>
            <div className="stats-filter">
              <button
                type="button"
                className="stats-filter-btn"
                onClick={() => setStatsFilterOpen((open) => !open)}
              >
                {statsRangeOptions.find((option) => option.value === statsRange)?.label}
                <span className="stats-filter-chevron">{statsFilterOpen ? '▴' : '▾'}</span>
              </button>
              {statsFilterOpen && (
                <div className="stats-filter-menu">
                  {statsRangeOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      className={`stats-filter-option ${statsRange === option.value ? 'active' : ''}`}
                      onClick={() => {
                        setStatsRange(option.value);
                        setStatsFilterOpen(false);
                      }}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="stats-preview-grid">
            <div className="stats-preview-item">
              <span className="eyebrow">Operaciones</span>
              <strong>{stats.operationsCount}</strong>
            </div>
            <div className="stats-preview-item">
              <span className="eyebrow">Win Rate</span>
              <strong>{stats.winRatePct != null ? `${stats.winRatePct}%` : '—'}</strong>
            </div>
            <div className="stats-preview-item">
              <span className="eyebrow">P&L {statsRangeLabels[statsRange]}</span>
              <strong className={stats.pnl >= 0 ? 'bullish' : 'bearish'}>
                {stats.pnl >= 0 ? '+' : ''}${stats.pnl.toFixed(2)}
              </strong>
            </div>
          </div>
          {stats.operationsCount < 2 && (
            <p className="hint-text">Necesitas al menos 2 operaciones para ver la curva.</p>
          )}
          <div className="stats-preview-footer">
            <Link to="/estadisticas" className="back-link">
              ver más →
            </Link>
          </div>
        </section>

        <section className="panel plan-section">
          <div className="section-header">
            <h3 style={{ textTransform: 'capitalize' }}>{monthLabel}</h3>
            <Link to="/historial" className="back-link">
              ver historial →
            </Link>
          </div>
          <MonthCalendar
            year={today.getFullYear()}
            month={today.getMonth()}
            summaryByDate={summaryByDate}
            todayKey={todayKey}
            onDayClick={(key) => navigate(`/journal/nuevo?date=${key}`)}
          />
        </section>
      </div>

      <aside className="inicio-side">
        <section className="panel profile-card">
          <button
            type="button"
            className="info-btn"
            onClick={() => setInfoOpen(true)}
            aria-label="Cómo funciona tu progreso"
          >
            ℹ
          </button>
          <Link to="/perfil" className="profile-identity-link">
            <div className="profile-avatar">
              <UserEmblem letter={displayName.slice(0, 1).toUpperCase()} size={56} />
            </div>
            <strong>{displayName}</strong>
          </Link>
          <div className={`badge-mark ${stage.accent}`}>
            <VirtusIcon level={stage.level as VirtusLevel} className="badge-mark-icon" />
          </div>
          <p className="hint-text">{stage.level}</p>
          <VirtusProgressBar virtusTotal={virtusTotal} todayDelta={todayDelta} peakTotal={peakTotal} />
          <div className="mastery-row">
            {stageBadges.map((badge) => (
              <div
                key={badge.level}
                className={`mastery-item ${badge.level === stage.level ? 'current' : ''}`}
              >
                <span className="icon-chip">
                  <VirtusIcon level={badge.level as VirtusLevel} className="icon-chip-svg" />
                  <span className="badge-tooltip">
                    <strong>{badge.level}</strong>
                    <span>{badge.name}</span>
                  </span>
                </span>
                <span className="mastery-item-label">{badge.level}</span>
              </div>
            ))}
          </div>

          <div className="ataraxia-quick-view">
            <span className="ataraxia-quick-title">Ataraxia</span>
            <AtaraxiaBar score={areteTotal} compact animated delta={areteDelta} />
            <Link to="/estadisticas" className="back-link">
              ver más →
            </Link>
          </div>
        </section>

        <ProgressInfoModal
          open={infoOpen}
          onClose={() => setInfoOpen(false)}
          virtusTotal={virtusTotal}
          areteScore={areteTotal}
        />

        <Link to="/buzon" className="panel mailbox-card">
          <span className="mailbox-icon-wrap">
            <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" className="mailbox-icon">
              <rect x="4" y="8" width="24" height="17" rx="2" />
              <path d="M5 9 L16 19 L27 9" />
            </svg>
            {mailboxCount > 0 && <span className="mailbox-badge">{mailboxCount}</span>}
          </span>
          <div>
            <h3>Buzón</h3>
            <p className="hint-text">
              {mailboxCount > 0
                ? `${mailboxCount} novedad${mailboxCount === 1 ? '' : 'es'}`
                : 'Sin novedades'}
            </p>
          </div>
        </Link>

        <section className="panel social-preview-card">
          <div className="section-header">
            <h3>Fraternidad</h3>
            <Link to="/social" className="back-link">
              + Agregar
            </Link>
          </div>

          {friends.length === 0 ? (
            <p className="hint-text">Aún no tienes amigos agregados.</p>
          ) : (
            <div className="friend-list">
              {friends.map((friend) => (
                <div className="friend-row" key={friend.userId}>
                  <span className="friend-avatar">{friend.label.slice(0, 2).toUpperCase()}</span>
                  <span className={`presence-dot ${isOnline(friend.lastSeenAt) ? 'online' : 'offline'}`} />
                  <span>{friend.label}</span>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="panel social-preview-card">
          <div className="section-header">
            <h3>Ágoras</h3>
            <Link to="/agoras" className="back-link">
              + Agregar
            </Link>
          </div>

          {agoras.length === 0 ? (
            <p className="hint-text">Aún no perteneces a ningún Ágora.</p>
          ) : (
            <div className="friend-list">
              {agoras.map((agora) => (
                <div className="friend-row" key={agora.id}>
                  <span className="friend-avatar">{agora.name.slice(0, 2).toUpperCase()}</span>
                  <span style={{ flex: 1 }}>{agora.name}</span>
                  <span className="nav-soon">
                    {agora.memberCount} miembro{agora.memberCount === 1 ? '' : 's'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      </aside>
      </div>
    </>
  );
}

function MissionRow({
  label,
  difficulty,
  points,
  done,
}: {
  label: string;
  difficulty: string;
  points: number;
  done: boolean;
}) {
  return (
    <div className={`mission-row ${done ? 'done' : ''}`}>
      <div className="mission-row-header">
        <span>{done ? '◉' : '◎'} {label}</span>
        <span className="mission-meta">
          <span className="nav-soon">{difficulty}</span> +{points}
        </span>
      </div>
      <div className="gauge-wrap">
        <span className="gauge-fill" style={{ width: done ? '100%' : '0%' }} />
      </div>
    </div>
  );
}

export default Dashboard;
