import { useEffect } from 'react';
import type { WeeklyRecapResult } from '../hooks/useOmegaAgent';
import OmegaMark from './OmegaMark';
import PsychoProfileCard from './PsychoProfileCard';

function WeeklyRecapModal({ open, onClose, result }: { open: boolean; onClose: () => void; result: WeeklyRecapResult | null }) {
  useEffect(() => {
    if (!open) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', handleKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  if (!open || !result) return null;

  const { recap, metrics } = result;

  return (
    <div className="info-modal-backdrop" onClick={onClose}>
      <div className="info-modal-panel recap-modal-panel" onClick={(event) => event.stopPropagation()}>
        <div className="info-modal-header">
          <div className="omega-feedback-eyebrow">
            <OmegaMark size={28} />
            <h2>Presentación Semanal</h2>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Cerrar">
            ✕
          </button>
        </div>
        <p className="hint-text">
          Semana del {metrics.weekStart} al {metrics.weekEnd}
        </p>

        <section className="info-modal-section">
          <h3>Métricas en Frío</h3>
          <div className="funding-summary-grid">
            <div className="funding-summary-item">
              <span className="eyebrow">Días Ganadores</span>
              <strong>{metrics.greenDays}</strong>
            </div>
            <div className="funding-summary-item">
              <span className="eyebrow">Días en Pérdida</span>
              <strong>{metrics.redDays}</strong>
            </div>
            <div className="funding-summary-item">
              <span className="eyebrow">Misiones Completadas</span>
              <strong>{metrics.missionsCompleted}</strong>
            </div>
            <div className="funding-summary-item">
              <span className="eyebrow">XP Ganada</span>
              <strong>{metrics.xpFromMissions}</strong>
            </div>
          </div>
        </section>

        <section className="info-modal-section">
          <h3>El Veredicto de Omega</h3>
          <p className="oraculo-text">{recap.weekly_verdict}</p>
        </section>

        <section className="info-modal-section">
          <h3>Radiografía Psicológica</h3>
          <div className="omega-psycho-grid">
            <PsychoProfileCard variant="strength" title="Mayor Fortaleza" items={[recap.top_strength]} />
            <PsychoProfileCard variant="leak" title="Fuga Crítica" items={[recap.critical_leak]} />
          </div>
        </section>

        <section className="info-modal-section">
          <h3>Plan de Acción Semanal</h3>
          <ol className="recap-action-plan">
            {recap.action_plan.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </section>

        <div className="journal-submit-row" style={{ marginTop: 20 }}>
          <button type="button" className="primary-btn btn-sm" onClick={onClose}>
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
}

export default WeeklyRecapModal;
