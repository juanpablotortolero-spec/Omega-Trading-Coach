export type VirtusLevel = 'LOGOS' | 'ETHOS' | 'PRAXIS' | 'KAIROS' | 'OMEGA';

const svgProps = {
  viewBox: '0 0 64 64',
  fill: 'none' as const,
  stroke: 'currentColor',
  strokeWidth: 1.3,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

/** Coin-medallion frame shared by every insignia. */
function Medallion() {
  return (
    <>
      <circle cx="32" cy="32" r="30" strokeWidth="1.1" />
      <circle cx="32" cy="32" r="26" strokeWidth="0.5" opacity="0.45" />
    </>
  );
}

/**
 * Line-art insignias for los 5 niveles de maestría — trazos finos, sin
 * rellenos sólidos, per .claude/CLAUDE_INSTRUCTIONS.md sección 3.
 */
function VirtusIcon({ level, className }: { level: VirtusLevel; className?: string }) {
  switch (level) {
    case 'LOGOS':
      return (
        <svg {...svgProps} className={className}>
          <Medallion />
          <path d="M14 20 L32 8 L50 20" />
          <line x1="12" y1="20" x2="52" y2="20" />
          <path d="M17 23 Q32 19 47 23" />
          <line x1="15" y1="23" x2="49" y2="23" />
          <line x1="20" y1="46" x2="20" y2="23" />
          <line x1="24" y1="46" x2="24" y2="23" />
          <line x1="28" y1="46" x2="28" y2="23" />
          <line x1="32" y1="46" x2="32" y2="23" />
          <line x1="36" y1="46" x2="36" y2="23" />
          <line x1="40" y1="46" x2="40" y2="23" />
          <line x1="44" y1="46" x2="44" y2="23" />
          <line x1="18" y1="49" x2="46" y2="49" />
          <line x1="16" y1="52" x2="48" y2="52" />
        </svg>
      );
    case 'ETHOS':
      return (
        <svg {...svgProps} className={className}>
          <Medallion />
          <path d="M32 12 L34.2 15 L32 18 L29.8 15 Z" />
          <circle cx="32" cy="15" r="3.4" />
          <line x1="32" y1="18" x2="32" y2="42" />
          <line x1="24" y1="48" x2="40" y2="48" />
          <line x1="32" y1="42" x2="24" y2="48" />
          <line x1="32" y1="42" x2="40" y2="48" />
          <line x1="14" y1="21" x2="50" y2="21" />
          <line x1="20" y1="21" x2="20" y2="24" />
          <line x1="26" y1="21" x2="26" y2="24" />
          <line x1="38" y1="21" x2="38" y2="24" />
          <line x1="44" y1="21" x2="44" y2="24" />
          <line x1="14" y1="21" x2="10" y2="33" />
          <line x1="14" y1="21" x2="18" y2="33" />
          <line x1="10" y1="33" x2="18" y2="33" />
          <path d="M9 33 Q14 41 19 33" />
          <line x1="11" y1="41" x2="17" y2="41" />
          <line x1="50" y1="21" x2="46" y2="33" />
          <line x1="50" y1="21" x2="54" y2="33" />
          <line x1="46" y1="33" x2="54" y2="33" />
          <path d="M45 33 Q50 41 55 33" />
          <line x1="47" y1="41" x2="53" y2="41" />
        </svg>
      );
    case 'PRAXIS':
      return (
        <svg {...svgProps} className={className}>
          <Medallion />
          <path d="M22 8 C17 8 15 12 17 16 C22 21 22 27 20 32 C22 37 22 43 17 48 C15 52 17 56 22 56" />
          <path d="M22 8 L22 26 L27 32 L22 38 L22 56" />
          <line x1="18" y1="26.5" x2="21.3" y2="25.5" />
          <line x1="18" y1="29.5" x2="21.3" y2="28.5" />
          <line x1="18" y1="35.5" x2="21.3" y2="34.5" />
          <line x1="18" y1="38.5" x2="21.3" y2="37.5" />
          <line x1="27" y1="32" x2="56" y2="10" />
          <path d="M47 11 L58 8 L55 18 Z" />
          <line x1="47" y1="11" x2="43" y2="14" />
          <line x1="55" y1="18" x2="52" y2="22" />
          <line x1="27" y1="32" x2="21" y2="37" />
          <path d="M24.5 33.5 L20 32.5 L23 37 Z" />
          <path d="M25.5 35.5 L21 36.5 L25 40 Z" />
        </svg>
      );
    case 'KAIROS':
      return (
        <svg {...svgProps} className={className}>
          <Medallion />
          <path d="M32 4.5 L34.3 8.5 L32 11 L29.7 8.5 Z" />
          <path d="M32 59.5 L34.3 55.5 L32 53 L29.7 55.5 Z" />
          <line x1="17" y1="9" x2="47" y2="9" />
          <line x1="15" y1="12" x2="49" y2="12" />
          <line x1="17" y1="55" x2="47" y2="55" />
          <line x1="15" y1="52" x2="49" y2="52" />
          <line x1="15" y1="12" x2="15" y2="52" />
          <line x1="49" y1="12" x2="49" y2="52" />
          <path d="M19 14 L45 14 L32 32 L45 50 L19 50 L32 32 Z" />
          <path d="M26 19.5 Q32 22.5 38 19.5" opacity="0.6" />
          <path d="M24 46.5 Q32 41.5 40 46.5" opacity="0.6" />
          <circle cx="32" cy="28" r="0.9" fill="currentColor" stroke="none" />
          <circle cx="32" cy="32.5" r="0.9" fill="currentColor" stroke="none" />
          <circle cx="32" cy="36.5" r="0.7" fill="currentColor" stroke="none" />
        </svg>
      );
    case 'OMEGA':
      return (
        <svg {...svgProps} className={className}>
          <Medallion />
          <line x1="32" y1="6" x2="32" y2="3" opacity="0.4" />
          <line x1="50.4" y1="13.6" x2="52.5" y2="11.5" opacity="0.4" />
          <line x1="58" y1="32" x2="61" y2="32" opacity="0.4" />
          <line x1="50.4" y1="50.4" x2="52.5" y2="52.5" opacity="0.4" />
          <line x1="32" y1="58" x2="32" y2="61" opacity="0.4" />
          <line x1="13.6" y1="50.4" x2="11.5" y2="52.5" opacity="0.4" />
          <line x1="6" y1="32" x2="3" y2="32" opacity="0.4" />
          <line x1="13.6" y1="13.6" x2="11.5" y2="11.5" opacity="0.4" />
          <path d="M27 40 C23 40 20.5 35.5 20.5 29 C20.5 20 25.5 14.5 32 14.5 C38.5 14.5 43.5 20 43.5 29 C43.5 35.5 41 40 37 40" opacity="0.5" />
          <path d="M25 43 C19 43 16 37 16 29 C16 17.5 23 10.5 32 10.5 C41 10.5 48 17.5 48 29 C48 37 45 43 39 43" />
          <line x1="25" y1="43" x2="20.5" y2="49.5" />
          <line x1="39" y1="43" x2="43.5" y2="49.5" />
          <path d="M11 52 Q7 31 15 15" />
          <path d="M53 52 Q57 31 49 15" />
          <line x1="12" y1="45.5" x2="7" y2="44.5" />
          <line x1="10" y1="39" x2="5" y2="38" />
          <line x1="9" y1="32.5" x2="4" y2="31.5" />
          <line x1="10" y1="26" x2="5" y2="25" />
          <line x1="12" y1="19.5" x2="7.5" y2="17.5" />
          <line x1="15" y1="14.5" x2="11.5" y2="11.5" />
          <line x1="52" y1="45.5" x2="57" y2="44.5" />
          <line x1="54" y1="39" x2="59" y2="38" />
          <line x1="55" y1="32.5" x2="60" y2="31.5" />
          <line x1="54" y1="26" x2="59" y2="25" />
          <line x1="52" y1="19.5" x2="56.5" y2="17.5" />
          <line x1="49" y1="14.5" x2="52.5" y2="11.5" />
          <circle cx="9" cy="51" r="1" fill="currentColor" stroke="none" />
          <circle cx="11.5" cy="53.2" r="1" fill="currentColor" stroke="none" />
          <circle cx="13.5" cy="50.3" r="1" fill="currentColor" stroke="none" />
          <circle cx="55" cy="51" r="1" fill="currentColor" stroke="none" />
          <circle cx="52.5" cy="53.2" r="1" fill="currentColor" stroke="none" />
          <circle cx="50.5" cy="50.3" r="1" fill="currentColor" stroke="none" />
        </svg>
      );
    default:
      return null;
  }
}

export default VirtusIcon;
