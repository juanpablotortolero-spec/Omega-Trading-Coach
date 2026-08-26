import type { MedalTierName } from '../lib/medals';

const TIER_CLASS: Record<MedalTierName, string> = {
  Bronce: 'medal-bronce',
  Plata: 'medal-plata',
  Oro: 'medal-oro',
  Platino: 'medal-platino',
  Diamante: 'medal-diamante',
  Rubí: 'medal-rubi',
  Esmeralda: 'medal-esmeralda',
};

/** Línea de arte minimalista (medalla + cinta), sin rellenos sólidos — mismo lenguaje visual que VirtusIcon. */
function MedalBadge({ tier, size = 44 }: { tier: MedalTierName | null; size?: number }) {
  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.3"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`medal-badge ${tier ? TIER_CLASS[tier] : 'medal-empty'}`}
      aria-hidden="true"
    >
      <path d="M22 6 L26 24 L18 24 Z" />
      <path d="M42 6 L38 24 L46 24 Z" />
      <circle cx="32" cy="38" r="18" />
      <circle cx="32" cy="38" r="13" opacity="0.5" />
      <path d="M32 30 L34.4 35 L40 35.8 L36 39.6 L37 45.2 L32 42.5 L27 45.2 L28 39.6 L24 35.8 L29.6 35 Z" />
    </svg>
  );
}

export default MedalBadge;
