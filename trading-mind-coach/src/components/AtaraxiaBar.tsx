import { useEffect, useState } from 'react';
import { scoreToColor } from '../lib/disciplineScore';

// Componente aislado — solo lectura visual del puntaje de disciplina ya
// calculado en otro lugar (computeDisciplineScore / computeDisciplineTimeline).
// No contiene lógica de negocio propia: recibe `score` y lo pinta, usando la
// misma paleta difuminada (scoreToColor) que el gráfico de Estadísticas.
function pillarName(score: number): string {
  if (score <= 35) return 'Miedo/Indisciplina';
  if (score <= 74) return 'Atlas';
  return 'Ataraxia';
}

function AtaraxiaBar({
  score,
  compact = false,
  animated = false,
  delta = null,
}: {
  score: number | null;
  compact?: boolean;
  animated?: boolean;
  /** Cambio frente a la sesión/promedio anterior (mismos puntos porcentuales que `score`). */
  delta?: number | null;
}) {
  // Cuando `animated` está activo, arranca en 0 y se revela hacia el valor
  // real justo después del montaje — igual que la barra de XP al abrir la
  // página. En uso "vivo" (Journal), simplemente refleja el score actual.
  const [visibleScore, setVisibleScore] = useState(animated ? 0 : score ?? 0);

  useEffect(() => {
    if (score === null) return;
    if (!animated) {
      setVisibleScore(score);
      return;
    }
    const id = requestAnimationFrame(() => setVisibleScore(score));
    return () => cancelAnimationFrame(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [score]);

  if (score === null) {
    return <p className="hint-text">Aún no hay suficiente información para calcular tu Ataraxia.</p>;
  }

  const color = scoreToColor(score);
  const pillar = pillarName(score);
  const hasDelta = delta !== null && delta !== undefined && Math.round(delta) !== 0;
  const deltaRounded = hasDelta ? Math.round(delta as number) : 0;

  const deltaChip = hasDelta && (
    <span className={`ataraxia-delta-chip ${deltaRounded > 0 ? 'up' : 'down'} ${compact ? 'compact' : ''}`}>
      {deltaRounded > 0 ? '▲' : '▼'} {deltaRounded > 0 ? '+' : ''}
      {deltaRounded}%
    </span>
  );

  return (
    <div className="ataraxia-block">
      {!compact && (
        <div className="ataraxia-heading">
          <h4 className="ataraxia-title">Estado Ataraxia</h4>
          <p className="ataraxia-subtitle">Medidor de ejecución mecánica y paz mental</p>
        </div>
      )}
      <div className={`ataraxia-gauge-wrap ${compact ? 'compact' : ''} ${animated ? 'animated' : ''}`}>
        <span className="ataraxia-fill" style={{ clipPath: `inset(0 ${100 - visibleScore}% 0 0)` }} />
        <span className="ataraxia-knob" style={{ left: `${visibleScore}%`, backgroundColor: color, color }}>
          <span className="ataraxia-knob-tooltip">
            {score}% · {pillar}
          </span>
        </span>
      </div>
      {!compact ? (
        <div className="ataraxia-detail-row">
          <span className="ataraxia-current" style={{ color }}>
            {score}%
          </span>
          {deltaChip}
        </div>
      ) : (
        deltaChip
      )}
    </div>
  );
}

export default AtaraxiaBar;
