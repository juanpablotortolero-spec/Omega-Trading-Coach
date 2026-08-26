import type { CSSProperties } from 'react';

type GameLevel = 'A' | 'B' | 'C';

const LEVEL_META: Record<GameLevel, { color: string; glow: string; label: string }> = {
  A: { color: 'var(--trade-bullish)', glow: 'rgba(82, 121, 111, 0.55)', label: 'Juego A — ejecución de élite' },
  B: { color: 'var(--accent-gold)', glow: 'rgba(201, 166, 107, 0.55)', label: 'Juego B — competente, con fugas' },
  C: { color: 'var(--trade-bearish)', glow: 'rgba(139, 58, 54, 0.55)', label: 'Juego C — fuera de proceso' },
};

function TendlerGameMeter({ level }: { level: GameLevel }) {
  const meta = LEVEL_META[level];

  return (
    <div className="tendler-meter">
      <div
        className="tendler-meter-ring"
        style={{ '--meter-color': meta.color, '--meter-glow': meta.glow } as CSSProperties}
      >
        <span className="tendler-meter-letter">{level}</span>
      </div>
      <p className="tendler-meter-caption">Estado Mental Identificado hoy</p>
      <p className="hint-text tendler-meter-sublabel">{meta.label}</p>
    </div>
  );
}

export default TendlerGameMeter;
