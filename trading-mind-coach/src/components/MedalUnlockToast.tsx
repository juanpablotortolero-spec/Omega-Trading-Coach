import { useEffect, useState } from 'react';
import { useMedals } from '../contexts/MedalContext';
import MissionBadge, { type MissionBadgeTier } from './MissionBadge';

const AUTO_DISMISS_MS = 7000;

const VIRTUE_PHRASES = ['tu disciplina', 'tu trabajo duro', 'tu paciencia', 'tu constancia', 'tu compromiso'];

/** Determinístico por medalla (mismo missionKey+tier siempre cae en la misma frase) — no cambia entre renders. */
function pickVirtuePhrase(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) % 997;
  return VIRTUE_PHRASES[hash % VIRTUE_PHRASES.length];
}

/**
 * Montado una sola vez en MainLayout (fuera de cualquier `.panel`, mismo
 * motivo que OmegaAlertModal/OnboardingCarousel: un ancestro con
 * backdrop-filter rompe `position: fixed`). A diferencia de la alerta de
 * Omega, esto es un toast — no bloquea la pantalla, se autodescarta.
 */
function MedalUnlockToast() {
  const { activeUnlock, dismissActiveUnlock } = useMedals();
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    if (!activeUnlock) return;
    setClosing(false);
    const timer = setTimeout(() => setClosing(true), AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [activeUnlock]);

  useEffect(() => {
    if (!closing) return;
    const timer = setTimeout(dismissActiveUnlock, 280);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [closing]);

  if (!activeUnlock) return null;

  const tier = activeUnlock.tierName as MissionBadgeTier;

  return (
    <div className={`medal-unlock-toast ${closing ? 'closing' : ''}`} role="status">
      <MissionBadge tier={tier} size={56} />
      <div className="medal-unlock-toast-body">
        <span className="eyebrow">Medalla desbloqueada</span>
        <p className="medal-unlock-toast-message">
          Por {pickVirtuePhrase(`${activeUnlock.missionKey}:${activeUnlock.tierIndex}`)}, alcanzaste{' '}
          <strong>{tier}</strong> en «{activeUnlock.label}».
        </p>
        <span className="medal-unlock-toast-xp">+{activeUnlock.points} XP Virtus</span>
      </div>
      <button
        type="button"
        className="icon-btn"
        aria-label="Cerrar notificación"
        onClick={() => setClosing(true)}
      >
        ✕
      </button>
    </div>
  );
}

export default MedalUnlockToast;
