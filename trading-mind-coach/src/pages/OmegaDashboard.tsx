import { useEffect, useState } from 'react';
import BriefingPreSesion from '../components/BriefingPreSesion';
import DailyMissions, { type DailyMissionItem } from '../components/DailyMissions';
import OmegaMark from '../components/OmegaMark';
import PsychoProfileCard from '../components/PsychoProfileCard';
import TendlerGameMeter from '../components/TendlerGameMeter';
import { useAuth } from '../contexts/AuthContext';
import { useOmega } from '../contexts/OmegaContext';
import type { HeadCoachAudit } from '../hooks/useOmegaAgent';
import { getTodayOmegaAudit } from '../lib/api';
import { localIsoDate } from '../lib/calendar';

const FEEDBACK_TEXT =
  'Tu ejecución dentro de la Killzone de Londres fue mecánica y limpia — entraste con el flujo institucional, no en contra de él. Fuera de esa ventana, dos entradas rompieron tu propio criterio de sesión. El patrón es claro: cuando esperás al setup dentro del horario, ejecutás como se debe. Cuando salís de esa ventana "porque el mercado se ve bien", ahí es donde se filtra el error.';

const STRENGTHS = ['Paciencia en Macros', 'Respeto al horario operativo dentro de Killzones', 'Gestión de riesgo consistente en entradas A+'];

const CAPITAL_LEAKS = ['FOMO en Breakers', 'Entradas fuera de la ventana operativa', 'Mover el stop loss tras una entrada emocional'];

const DAILY_MISSIONS: DailyMissionItem[] = [
  { id: '1', label: 'Cerrar sesión al 1er Stop Loss técnico', rewardXp: 500 },
  { id: '2', label: 'Registrar el motivo de cada entrada antes de ejecutar', rewardXp: 300 },
];

const MANUAL_AUDIT_TEXT =
  'Detecté 3 entradas por FOMO en Breakers fuera de tu ventana operativa esta semana. Sugiero agregar una regla nueva a tu Manual Operativo: "No abrir posiciones nuevas fuera de la Killzone de Londres, sin excepción."';

function formatProfileItems(items: HeadCoachAudit['strengths'] | HeadCoachAudit['weaknesses']): string[] {
  return items.map((item) => (item.fix ? `${item.behavior} — ${item.fix}` : item.behavior));
}

function OmegaDashboard() {
  const { user } = useAuth();
  const { requestHeadCoachAudit } = useOmega();
  const [audit, setAudit] = useState<HeadCoachAudit | null>(null);
  const [auditing, setAuditing] = useState(false);
  const [auditError, setAuditError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    getTodayOmegaAudit(user.id, localIsoDate(new Date())).then((row) => {
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
  }, [user]);

  const handleAudit = async () => {
    if (auditing) return;
    setAuditing(true);
    setAuditError(null);
    try {
      const result = await requestHeadCoachAudit();
      setAudit(result);
    } catch (err) {
      setAuditError(err instanceof Error ? err.message : 'No se pudo auditar la sesión.');
    } finally {
      setAuditing(false);
    }
  };

  const missions: DailyMissionItem[] = audit
    ? audit.daily_missions.map((mission) => ({ id: String(mission.id), label: mission.task, rewardXp: mission.xpReward }))
    : DAILY_MISSIONS;

  const strengths = audit ? formatProfileItems(audit.strengths) : STRENGTHS;
  const weaknesses = audit ? formatProfileItems(audit.weaknesses) : CAPITAL_LEAKS;
  const feedbackText = audit?.daily_feedback ?? FEEDBACK_TEXT;
  const gameLevel = audit?.game_state ?? 'B';
  const auditText = audit
    ? `${audit.manual_audit.issue_detected ? `${audit.manual_audit.issue_detected} ` : ''}${audit.manual_audit.suggested_rule}`.trim()
    : MANUAL_AUDIT_TEXT;

  return (
    <div className="omega-hq">
      <header className="omega-hq-header">
        <OmegaMark size={40} />
        <div className="omega-hq-header-copy">
          <h2>Omega — Head Coach</h2>
          <p className="hint-text">Tu centro de mando dedicado a Omega — en construcción.</p>
        </div>
        <button type="button" className="primary-btn btn-sm omega-hq-audit-btn" onClick={handleAudit} disabled={auditing}>
          {auditing ? 'Omega analizando sesión…' : 'Auditar Última Sesión'}
        </button>
      </header>

      {auditError && <p className="omega-chat-error">{auditError}</p>}

      <BriefingPreSesion />

      <div className="omega-hq-grid">
        <section className="panel omega-hq-col omega-hq-col-status">
          <h3>Estado</h3>
          <TendlerGameMeter level={gameLevel} />
        </section>

        <section className="panel omega-hq-col omega-hq-col-feed">
          <h3>Conversación</h3>

          <div className="omega-feedback-box">
            <div className="omega-feedback-eyebrow">
              <OmegaMark size={22} />
              <span className="eyebrow">Feedback de Omega — última sesión</span>
            </div>
            <p className="omega-feedback-text">{feedbackText}</p>
          </div>

          <div className="omega-psycho-grid">
            <PsychoProfileCard variant="strength" title="Fortalezas" items={strengths} />
            <PsychoProfileCard variant="leak" title="Fugas de Capital" items={weaknesses} />
          </div>
        </section>

        <section className="panel omega-hq-col omega-hq-col-missions">
          <h3>Misiones y Metas</h3>
          <DailyMissions missions={missions} />

          <div className="manual-audit-alert">
            <div className="manual-audit-alert-header">
              <span className="manual-audit-alert-icon" aria-hidden="true">
                ⚠
              </span>
              <span className="eyebrow">Alerta de Auditoría del Manual</span>
            </div>
            <p className="manual-audit-alert-text">{auditText}</p>
          </div>
        </section>
      </div>
    </div>
  );
}

export default OmegaDashboard;
