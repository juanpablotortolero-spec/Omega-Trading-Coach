import { useEffect } from 'react';
import type { MonthlyCloseResult } from '../hooks/useOmegaAgent';
import OmegaMark from './OmegaMark';
import PsychoProfileCard from './PsychoProfileCard';

function MonthlyCloseModal({ open, onClose, result }: { open: boolean; onClose: () => void; result: MonthlyCloseResult | null }) {
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

  const { close, metrics } = result;

  return (
    <div className="info-modal-backdrop" onClick={onClose}>
      <div className="info-modal-panel recap-modal-panel" onClick={(event) => event.stopPropagation()}>
        <div className="info-modal-header">
          <div className="omega-feedback-eyebrow">
            <OmegaMark size={28} />
            <h2 style={{ textTransform: 'capitalize' }}>Auditoría Mensual — {metrics.monthLabel}</h2>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Cerrar">
            ✕
          </button>
        </div>
        <p className="hint-text">
          Del {metrics.monthStart} al {metrics.monthEnd}
        </p>

        <section className="info-modal-section">
          <h3>Métricas en Frío</h3>
          <div className="funding-summary-grid">
            <div className="funding-summary-item">
              <span className="eyebrow">Operaciones</span>
              <strong>{metrics.tradesCount}</strong>
            </div>
            <div className="funding-summary-item">
              <span className="eyebrow">Ganadoras / Perdedoras</span>
              <strong>
                {metrics.winCount} / {metrics.lossCount}
              </strong>
            </div>
            <div className="funding-summary-item">
              <span className="eyebrow">P&L Neto</span>
              <strong className={metrics.pnlTotal >= 0 ? 'bullish' : 'bearish'}>
                {metrics.pnlTotal >= 0 ? '+' : ''}${metrics.pnlTotal.toFixed(2)}
              </strong>
            </div>
            <div className="funding-summary-item">
              <span className="eyebrow">Ataraxia Promedio</span>
              <strong>{metrics.ataraxiaAvg !== null ? `${metrics.ataraxiaAvg}%` : '—'}</strong>
            </div>
            <div className="funding-summary-item">
              <span className="eyebrow">Rupturas de Plan</span>
              <strong>{metrics.brokePlanCount}</strong>
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
          <p className="oraculo-text">{close.monthly_verdict}</p>
        </section>

        <section className="info-modal-section">
          <h3>Ejecución del Mes</h3>
          <p className="oraculo-text">{close.execution_summary}</p>
        </section>

        <section className="info-modal-section">
          <h3>Evolución Psicológica</h3>
          <p className="oraculo-text">{close.psychological_evolution}</p>
        </section>

        <section className="info-modal-section">
          <h3>Radiografía Psicológica del Mes</h3>
          <div className="omega-psycho-grid">
            <PsychoProfileCard variant="strength" title="Mayor Fortaleza" items={[close.top_strength]} />
            <PsychoProfileCard variant="leak" title="Fuga Crítica" items={[close.critical_leak]} />
          </div>
        </section>

        <section className="info-modal-section">
          <h3>Objetivos del Próximo Mes</h3>
          <ol className="recap-action-plan">
            {close.next_month_objectives.map((objective) => (
              <li key={objective}>{objective}</li>
            ))}
          </ol>
        </section>

        <section className="info-modal-section">
          <h3>Plan de Acción</h3>
          <ol className="recap-action-plan">
            {close.action_plan.map((step) => (
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

export default MonthlyCloseModal;
