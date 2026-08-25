import { useId } from 'react';

type Props = {
  letter: string;
  size?: number;
  className?: string;
};

/**
 * The user's identity avatar, built on the exact same pattern as OmegaMark
 * (the app's main logo): two clean SVG rings behind a CSS-centered Cinzel
 * glyph with a gold gradient fill. Same simple, approved look — just a
 * dynamic letter instead of Ω, no extra ornamentation.
 */
function UserEmblem({ letter, size = 56, className }: Props) {
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
        aria-hidden="true"
        style={{
          position: 'relative',
          zIndex: 1,
          fontFamily: "'Cinzel', serif",
          fontWeight: 800,
          fontSize: size * 0.42,
          lineHeight: 1,
          background: `linear-gradient(180deg, #FFFBF0 0%, #F3DBA9 26%, #D8B37C 58%, #A97F49 100%)`,
          WebkitBackgroundClip: 'text',
          backgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          filter: 'drop-shadow(0 1px 0.5px rgba(0,0,0,0.65))',
        }}
      >
        {letter}
      </span>
    </div>
  );
}

export default UserEmblem;
