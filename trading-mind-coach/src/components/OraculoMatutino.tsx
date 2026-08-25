import { useEffect, useRef, useState } from 'react';
import { useOmega } from '../contexts/OmegaContext';
import { localIsoDate } from '../lib/calendar';
import { EffectsSummary } from './OmegaChat';
import OmegaMark from './OmegaMark';

/**
 * Briefing pre-sesión automático al cargar el Dashboard. Se pide una sola vez
 * por día (guardado en sessionStorage con la fecha en la clave) — revisitar
 * el Dashboard el mismo día no vuelve a llamar a Omega, solo muestra el texto
 * ya recibido.
 */
function OraculoMatutino() {
  const { messages, sending, error, lastEffects, requestBriefing } = useOmega();
  const todayIso = localIsoDate(new Date());
  const storageKey = `omega-briefing-${todayIso}`;

  const [briefingText, setBriefingText] = useState<string | null>(() => sessionStorage.getItem(storageKey));
  const [waiting, setWaiting] = useState(false);
  const requestedRef = useRef(false);

  useEffect(() => {
    if (requestedRef.current) return;
    requestedRef.current = true;
    if (sessionStorage.getItem(storageKey)) return;
    setWaiting(true);
    requestBriefing();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    <section className="panel oraculo-matutino">
      <div className="oraculo-header">
        <OmegaMark size={38} />
        <div>
          <h3>Oráculo Matutino</h3>
          <span className="hint-text">Briefing de Omega para tu sesión de hoy</span>
        </div>
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
          <p className="oraculo-text">{briefingText}</p>
          {lastEffects && <EffectsSummary effects={lastEffects} />}
        </>
      )}

      {!waiting && !briefingText && error && <p className="omega-chat-error">{error}</p>}
    </section>
  );
}

export default OraculoMatutino;
