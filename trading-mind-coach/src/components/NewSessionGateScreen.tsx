import { useNavigate } from 'react-router-dom';
import OmegaMark from './OmegaMark';

/**
 * Bloquea la apertura de "Nuevo journal" de HOY hasta que el trader complete
 * el check-in pre-sesión + acepte el Briefing (ver PreSessionCheckInModal,
 * disparado por "Nueva Sesión" en Inicio) — mismo patrón que QuarantineScreen,
 * pero con una acción real en vez de solo informar. Solo aplica mientras la
 * Fase 1 de hoy sigue sin sellar (ver JournalEntry.tsx) — una vez sellada, no
 * vuelve a bloquear retroactivamente.
 */
function NewSessionGateScreen() {
  const navigate = useNavigate();

  return (
    <div className="quarantine-screen new-session-gate">
      <div className="quarantine-icon">
        <OmegaMark size={56} />
      </div>
      <h2>Antes de operar, tu check-in de hoy</h2>
      <p className="quarantine-message">
        Todavía no hiciste tu check-in pre-sesión ni aceptaste el Briefing de hoy — es el primer paso obligatorio
        antes de abrir tu journal.
      </p>
      <button type="button" className="primary-btn" onClick={() => navigate('/dashboard')}>
        Ir a Nueva Sesión →
      </button>
    </div>
  );
}

export default NewSessionGateScreen;
