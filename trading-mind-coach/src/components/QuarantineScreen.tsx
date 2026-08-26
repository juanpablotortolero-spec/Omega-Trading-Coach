import type { WeeklyKillSwitchStatus } from '../lib/api';
import OmegaMark from './OmegaMark';

function QuarantineScreen({ status }: { status: WeeklyKillSwitchStatus }) {
  const isRedLimit = status.triggered === 'red_limit';

  const title = isRedLimit ? 'Cuarentena Activa — Capital Preservado' : 'Cuarentena Activa — Riesgo de Euforia';
  const message = isRedLimit
    ? `Alcanzaste el límite de ${status.redDays} días en pérdida esta semana. Capital preservado. Nos vemos el lunes.`
    : `${status.greenDays} días de Take Profit alcanzados esta semana. Riesgo de euforia inminente. Cierra las pantallas.`;

  return (
    <div className={`quarantine-screen ${isRedLimit ? 'danger' : 'euphoria'}`}>
      <div className="quarantine-icon">
        <OmegaMark size={56} />
      </div>
      <h2>{title}</h2>
      <p className="quarantine-message">{message}</p>
      <div className="quarantine-stats">
        <span>Días en pérdida: {status.redDays}/3</span>
        <span>Días ganadores: {status.greenDays}/4</span>
        <span>
          Semana del {status.weekStart} al {status.weekEnd}
        </span>
      </div>
      <p className="hint-text">El bloqueo se levanta automáticamente el lunes a las 00:00.</p>
    </div>
  );
}

export default QuarantineScreen;
