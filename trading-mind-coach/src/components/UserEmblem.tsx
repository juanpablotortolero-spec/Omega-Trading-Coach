import type { CSSProperties } from 'react';

type Props = {
  letter: string;
  size?: number;
  className?: string;
};

/**
 * El avatar de identidad del usuario — sin aro/marco: el glifo respira solo,
 * con el mismo resplandor dorado pulsante que el logo de Omega y los rangos
 * Virtus (mission-badge-pulse), en vez del doble anillo SVG que tenía antes.
 */
function UserEmblem({ letter, size = 56, className }: Props) {
  return (
    <div
      className={className}
      style={
        {
          position: 'relative',
          width: size,
          height: size,
          display: 'grid',
          placeItems: 'center',
          '--badge-glow-color': 'rgba(201, 166, 107, 0.55)',
          '--badge-glow-lo': `${Math.max(3, size * 0.06)}px`,
          '--badge-glow-hi': `${Math.max(8, size * 0.16)}px`,
          animation: 'mission-badge-pulse 3.6s ease-in-out infinite',
        } as CSSProperties
      }
    >
      <span
        aria-hidden="true"
        style={{
          fontFamily: "'Cinzel', serif",
          fontWeight: 800,
          fontSize: size * 0.48,
          lineHeight: 1,
          background: `linear-gradient(180deg, #FFFBF0 0%, #F3DBA9 26%, #D8B37C 58%, #A97F49 100%)`,
          WebkitBackgroundClip: 'text',
          backgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
        }}
      >
        {letter}
      </span>
    </div>
  );
}

export default UserEmblem;
