import { useId } from 'react';

type Props = {
  size?: number;
  className?: string;
};

/**
 * Two precise SVG rings (perfectly centered by construction) behind a
 * CSS-centered Cinzel "Ω" glyph — text-based so it inherits the font's own
 * refined letterform instead of a hand-drawn approximation, and centers via
 * flexbox instead of SVG text-baseline math (which was the source of the
 * off-center look in the previous version).
 */
function OmegaMark({ size = 32, className }: Props) {
  const uid = useId();
  const fillId = `${uid}-fill`;
  const glossId = `${uid}-gloss`;

  return (
    <div
      className={className}
      style={{
        position: 'relative',
        width: size,
        height: size,
        display: 'grid',
        placeItems: 'center',
      }}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 100 100"
        style={{ position: 'absolute', inset: 0 }}
        aria-hidden="true"
      >
        <defs>
          <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#FFFBF0" />
            <stop offset="26%" stopColor="#F3DBA9" />
            <stop offset="58%" stopColor="#D8B37C" />
            <stop offset="100%" stopColor="#A97F49" />
          </linearGradient>
          <radialGradient id={glossId} cx="50%" cy="24%" r="50%">
            <stop offset="0%" stopColor="#FFFDF4" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#FFFDF4" stopOpacity="0" />
          </radialGradient>
        </defs>
        <circle cx="50" cy="50" r="46" fill="none" stroke={`url(#${fillId})`} strokeWidth="2" opacity="0.5" />
        <circle cx="50" cy="50" r="39" fill="none" stroke={`url(#${fillId})`} strokeWidth="2.6" opacity="0.9" />
        <circle cx="50" cy="50" r="35" fill={`url(#${glossId})`} />
      </svg>

      <span
        role="img"
        aria-label="Omega"
        style={{
          position: 'relative',
          zIndex: 1,
          fontFamily: "'Cinzel', serif",
          fontWeight: 800,
          fontSize: size * 0.62,
          lineHeight: 1,
          background: `linear-gradient(180deg, #FFFBF0 0%, #F3DBA9 26%, #D8B37C 58%, #A97F49 100%)`,
          WebkitBackgroundClip: 'text',
          backgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          filter: 'drop-shadow(0 1px 0.5px rgba(0,0,0,0.65))',
        }}
      >
        &Omega;
      </span>
    </div>
  );
}

export default OmegaMark;
