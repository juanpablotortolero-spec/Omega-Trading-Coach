import { useOmega } from '../contexts/OmegaContext';
import type { ActiveAlert } from '../hooks/useOmegaAgent';

const SEVERITY_LABEL: Record<ActiveAlert['severity'], string> = {
  info: 'Omega',
  warning: 'Omega — atención',
  critical: 'Omega — crítico',
};

/**
 * Montado una sola vez en MainLayout, junto a <OmegaChat /> (no adentro) —
 * así una alerta crítica disparada por el chat, el Oráculo Matutino o la
 * auditoría al sellar el journal se ve sin importar qué pantalla la disparó.
 */
function OmegaAlertModal() {
  const { uiAlerts, dismissAlert } = useOmega();
  const activeAlert = uiAlerts[0] ?? null;

  if (!activeAlert) return null;

  return (
    <div className="omega-alert-backdrop" onClick={() => dismissAlert(activeAlert.id)}>
      <div className={`omega-alert-card ${activeAlert.severity}`} onClick={(event) => event.stopPropagation()}>
        <div className="omega-alert-eyebrow">
          <span className="eyebrow">{SEVERITY_LABEL[activeAlert.severity]}</span>
          <button
            type="button"
            className="icon-btn"
            aria-label="Cerrar alerta"
            onClick={() => dismissAlert(activeAlert.id)}
          >
            ✕
          </button>
        </div>
        <p className="omega-alert-message">{activeAlert.message}</p>
        <button type="button" className="primary-btn btn-sm" onClick={() => dismissAlert(activeAlert.id)}>
          Entendido
        </button>
      </div>
    </div>
  );
}

export default OmegaAlertModal;
