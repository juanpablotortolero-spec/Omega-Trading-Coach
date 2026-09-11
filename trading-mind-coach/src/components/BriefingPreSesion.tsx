import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useOmega } from '../contexts/OmegaContext';
import { getBriefingByDate } from '../lib/api';
import { localIsoDate } from '../lib/calendar';
import EffectsSummary from './EffectsSummary';
import OmegaMark from './OmegaMark';

/**
 * Briefing pre-sesión para OmegaDashboard. `sessionStorage` es solo una
 * micro-cache para no repetir la consulta al servidor en cada remount DENTRO
 * de la misma pestaña — la fuente de verdad real es `omega_briefings`
 * (persistido por omega-coach al generarlo). Antes esto confiaba únicamente
 * en `sessionStorage`, que se vacía al cerrar la pestaña/navegador: cada
 * sesión de browser nueva el mismo día volvía a llamar a Anthropic desde
 * cero aunque el briefing de hoy ya existiera guardado — gasto real sin
 * ningún beneficio. Ahora SIEMPRE se chequea el servidor primero.
 */
function BriefingPreSesion() {
  const { user } = useAuth();
  const { messages, sending, error, lastEffects, requestBriefing } = useOmega();
  const todayIso = localIsoDate(new Date());
  const storageKey = `omega-briefing-${todayIso}`;

  const [briefingText, setBriefingText] = useState<string | null>(() => sessionStorage.getItem(storageKey));
  const [waiting, setWaiting] = useState(false);
  const requestedRef = useRef(false);

  useEffect(() => {
    if (requestedRef.current || !user) return;
    requestedRef.current = true;

    const cached = sessionStorage.getItem(storageKey);
    if (cached) {
      setBriefingText(cached);
      return;
    }

    setWaiting(true);
    getBriefingByDate(user.id, todayIso)
      .then((existing) => {
        if (existing) {
          setBriefingText(existing);
          sessionStorage.setItem(storageKey, existing);
          setWaiting(false);
          return;
        }
        // Recién acá, con el servidor confirmando que HOY no hay briefing
        // guardado, se justifica gastar una llamada real a Anthropic.
        requestBriefing();
      })
      .catch(() => {
        // Si falla la lectura (no la generación), no bloqueamos al trader —
        // sigue al pedido normal en vez de dejarlo sin briefing.
        requestBriefing();
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => {
    if (!waiting || sending) return;
    const last = messages[messages.length - 1];
    if (last?.role === 'assistant') {
      setBriefingText(last.content);
      sessionStorage.setItem(storageKey, last.content);
    }
    setWaiting(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sending]);

  if (!waiting && !briefingText && !error) return null;

  return (
    <div className="omega-feedback-box briefing-presesion">
      <div className="omega-feedback-eyebrow">
        <OmegaMark size={22} />
        <span className="eyebrow">Briefing Pre-Sesión — Omega</span>
      </div>

      {waiting && (
        <div className="oraculo-loading">
          <div className="skeleton oraculo-skeleton-line" />
          <div className="skeleton oraculo-skeleton-line" />
          <div className="skeleton oraculo-skeleton-line" style={{ width: '55%' }} />
        </div>
      )}

      {!waiting && briefingText && (
        <>
          <p className="omega-feedback-text">{briefingText}</p>
          {lastEffects && <EffectsSummary effects={lastEffects} />}
        </>
      )}

      {!waiting && !briefingText && error && (
        <>
          <p className="omega-chat-error">{error}</p>
          <button
            type="button"
            className="ghost-btn btn-sm"
            onClick={() => {
              setWaiting(true);
              requestBriefing();
            }}
          >
            Reintentar
          </button>
        </>
      )}
    </div>
  );
}

export default BriefingPreSesion;
