import { useAtaraxiaIntervention } from '../contexts/AtaraxiaRealtimeContext';
import OmegaMark from './OmegaMark';

/**
 * Montada una sola vez en MainLayout, junto a OmegaAlertModal — a diferencia
 * de esa, esta NO se cierra haciendo click afuera: exige el acuse explícito,
 * porque mientras está abierta bloquea los botones de ejecución operativa
 * (Registrar sesión, Nuevo journal, Agregar operación — ver
 * useAtaraxiaIntervention en cada uno).
 */
function AtaraxiaInterventionModal() {
  const { intervention, acknowledgeIntervention } = useAtaraxiaIntervention();

  if (!intervention) return null;

  return (
    <div className="ataraxia-intervention-backdrop" role="alertdialog" aria-label="Intervención de Omega">
      <div className="ataraxia-intervention-card">
        <div className="ataraxia-intervention-icon">
          <OmegaMark size={48} />
        </div>
        <span className="eyebrow">Zona Miedo/Indisciplina — {intervention.score}%</span>
        <h2>Cierra la plataforma. Sal a entrenar.</h2>
        <p className="ataraxia-intervention-message">{intervention.verdict}</p>
        <p className="hint-text">
          El acceso a nuevas operaciones queda bloqueado hasta que confirmes que leíste esto.
        </p>
        <button type="button" className="primary-btn" onClick={acknowledgeIntervention}>
          Entendido — voy a cerrar
        </button>
      </div>
    </div>
  );
}

export default AtaraxiaInterventionModal;
