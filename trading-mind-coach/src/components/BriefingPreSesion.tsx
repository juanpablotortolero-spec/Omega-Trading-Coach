import { useEffect, useRef, useState } from 'react';
import { useOmega } from '../contexts/OmegaContext';
import { localIsoDate } from '../lib/calendar';
import { EffectsSummary } from './OmegaChat';
import OmegaMark from './OmegaMark';

/**
 * Briefing pre-sesión para OmegaDashboard — MISMA clave de sessionStorage que
 * OraculoMatutino.tsx (Dashboard normal): es literalmente el mismo briefing
 * del día mostrado en dos pantallas, así visitar ambas el mismo día no
 * duplica la llamada a Anthropic.
 */
function BriefingPreSesion() {
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

      {!waiting && !briefingText && error && <p className="omega-chat-error">{error}</p>}
    </div>
  );
}

export default BriefingPreSesion;
