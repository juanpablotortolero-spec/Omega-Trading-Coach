import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getBriefingByDate, getTodayPreSessionResponse, getTradingPlan, saveBriefing } from '../lib/api';
import { localIsoDate } from '../lib/calendar';
import {
  getEventsForDate,
  getWeeklyEconomicEvents,
  isWithinFetchedWeek,
  type EconomicEvent,
} from '../lib/economicCalendar';
import { buildDeterministicBriefing, getLatestPriorDisciplineDay } from '../lib/omegaCoachTemplates';
import OmegaMark from './OmegaMark';

/**
 * Briefing pre-sesión, ahora 100% determinista (sin Anthropic/Edge Function)
 * — 3 líneas fijas (diagnóstico, correlación, regla de oro) armadas desde
 * datos reales del trader (ver buildDeterministicBriefing). `sessionStorage`
 * sigue siendo solo una micro-cache para no repetir la consulta al servidor
 * en cada remount DENTRO de la misma pestaña — la fuente de verdad real es
 * `omega_briefings`.
 */
function BriefingPreSesion() {
  const { user } = useAuth();
  const todayIso = localIsoDate(new Date());
  const storageKey = `omega-briefing-${todayIso}`;

  const [briefingText, setBriefingText] = useState<string | null>(() => sessionStorage.getItem(storageKey));
  const [waiting, setWaiting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestedRef = useRef(false);

  const generate = async () => {
    if (!user) return;
    setWaiting(true);
    setError(null);
    try {
      const [checkIn, plan, yesterday] = await Promise.all([
        getTodayPreSessionResponse(user.id, todayIso),
        getTradingPlan(user.id),
        getLatestPriorDisciplineDay(user.id, todayIso),
      ]);

      let todayHighImpactEvents: EconomicEvent[] | null = null;
      if (isWithinFetchedWeek(todayIso)) {
        try {
          const weekEvents = await getWeeklyEconomicEvents();
          todayHighImpactEvents = getEventsForDate(weekEvents, todayIso).filter((event) => event.impact === 'High');
        } catch {
          // El calendario económico es un extra del briefing, no su núcleo.
          todayHighImpactEvents = null;
        }
      }

      const content = buildDeterministicBriefing({ checkIn, yesterday, todayHighImpactEvents, plan });
      await saveBriefing(user.id, todayIso, content);
      setBriefingText(content);
      sessionStorage.setItem(storageKey, content);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo generar el briefing.');
    } finally {
      setWaiting(false);
    }
  };

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
        generate();
      })
      .catch(() => generate());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

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

      {!waiting && briefingText && <p className="omega-feedback-text">{briefingText}</p>}

      {!waiting && !briefingText && error && (
        <>
          <p className="omega-chat-error">{error}</p>
          <button type="button" className="ghost-btn btn-sm" onClick={generate}>
            Reintentar
          </button>
        </>
      )}
    </div>
  );
}

export default BriefingPreSesion;
