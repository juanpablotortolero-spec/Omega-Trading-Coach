import { useEffect } from 'react';
import { rankPenaltyMultiplier, stageBadges } from '../lib/virtus';

type VirtusPointRule = { points: number; label: string };

const virtusPointRules: VirtusPointRule[] = [
  { points: 5, label: 'Registrar tu estado emocional del día' },
  { points: 5, label: 'Definir tu Directriz Operativa antes de operar' },
  { points: 10, label: 'Completar tu journal con al menos una operación' },
  { points: 15, label: 'Completar el Quiz Post-Mercado' },
  { points: 50, label: 'Ninguna operación incumplió tu plan' },
  { points: 40, label: 'Respetar tu manejo de riesgo' },
  { points: 30, label: 'Operar dentro de tu ventana horaria óptima' },
  { points: 20, label: 'Tu estado emocional predominante fue constructivo' },
  { points: 20, label: 'Respetar tu narrativa pre-sesión' },
  { points: 15, label: 'Tu bias del día resulta correcto' },
  { points: 25, label: 'Ejecutar un setup que cumple los parámetros' },
  { points: -50, label: 'Alguna operación incumplió tu plan' },
  { points: -40, label: 'No respetar tu manejo de riesgo' },
  { points: -30, label: 'Operar fuera de tu ventana horaria óptima' },
  { points: -25, label: 'Ejecutar un setup que no cumple los parámetros' },
  { points: -20, label: 'Predominaron emociones destructivas en tu operativa' },
  { points: -20, label: 'No respetar tu narrativa pre-sesión' },
  { points: -15, label: 'Tu bias del día resulta incorrecto' },
];

const pillars = [
  {
    name: 'Miedo/Indisciplina',
    range: '0% – 35%',
    color: '#8B3A36',
    description:
      'Caos y Tilt. Dominan el FOMO, la venganza o las decisiones fuera de tu plan. En esta zona, tus penalizaciones de Virtus se multiplican ×1.5 — los errores cometidos en Tilt cuestan más caro.',
  },
  {
    name: 'Atlas',
    range: '36% – 74%',
    color: '#8A6B4E',
    description:
      'Fricción y lucha. Hay dudas y aciertos mezclados con errores — estás sosteniendo el peso, pero sin fluidez. Aquí no hay bonos ni castigos extra: tus puntos Virtus se registran a valor normal.',
  },
  {
    name: 'Ataraxia',
    range: '75% – 100%',
    color: '#4A6B82',
    description:
      'Mente fría y ejecución mecánica. Sostener esta zona 3 sesiones seguidas activa una Racha de Flujo: todos tus puntos Virtus positivos de esa sesión suman +20%.',
  },
];

function ProgressInfoModal({
  open,
  onClose,
  virtusTotal,
  areteScore,
}: {
  open: boolean;
  onClose: () => void;
  virtusTotal?: number;
  areteScore?: number | null;
}) {
  useEffect(() => {
    if (!open) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  // Congela el scroll del fondo mientras el modal está abierto; lo restaura
  // exactamente como estaba en cuanto se cierra.
  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  if (!open) return null;

  const currentStageLevel =
    virtusTotal !== undefined
      ? [...stageBadges].reverse().find((badge) => virtusTotal >= badge.minPoints)?.level
      : undefined;

  const currentRankMultiplier = currentStageLevel ? rankPenaltyMultiplier(currentStageLevel) : undefined;

  const currentPillar =
    areteScore != null ? (areteScore <= 35 ? 'Miedo/Indisciplina' : areteScore <= 74 ? 'Atlas' : 'Ataraxia') : undefined;

  return (
    <div className="info-modal-backdrop" onClick={onClose}>
      <div className="info-modal-panel" onClick={(event) => event.stopPropagation()}>
        <div className="info-modal-header">
          <h2>Cómo funciona tu progreso</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Cerrar">
            ✕
          </button>
        </div>

        <section className="info-modal-section">
          <h3>La diferencia: Micro vs. Macro</h3>
          <p>
            La plataforma mide tu disciplina en dos escalas de tiempo distintas, y ambas están conectadas.
          </p>
          <p>
            <strong>Ataraxia es el MICRO</strong> — el termómetro emocional y de disciplina de tu sesión de hoy.
            Sube y baja según cómo operaste hoy, sin memoria de ayer.
          </p>
          <p>
            <strong>Virtus es el MACRO</strong> — tu identidad, tu rango y tu historial a largo plazo. Nunca se
            reinicia: solo acumula el resultado de cada sesión que registras.
          </p>
          <p>
            En una frase: <strong>Ataraxia es el combustible; Virtus es el vehículo.</strong> Cómo quemas ese
            combustible hoy — con calma o en Tilt — cambia cuánto avanza (o retrocede) tu vehículo.
          </p>
        </section>

        <section className="info-modal-section">
          <h3>Ataraxia — las 3 zonas</h3>
          <p>
            Ataraxia mide, del 0% al 100%, qué tan fielmente ejecutas tu Manual Operativo — en una sesión (Journal)
            o en promedio a lo largo del tiempo (Inicio y Estadísticas). Se calcula sumando únicamente lo que
            realmente respondiste ese día — tu bias, tu narrativa, el setup ejecutado, tu manejo de riesgo, tus
            ventanas de sesión y tu estado emocional predominante. Los días sin suficiente información simplemente
            no cuentan; nunca se fabrica un resultado.
          </p>

          <div className="info-pillar-list">
            {pillars.map((pillar) => (
              <div key={pillar.name} className="info-pillar-card">
                <div className="info-pillar-header">
                  <span className="info-pillar-name" style={{ color: pillar.color }}>
                    {pillar.name}
                  </span>
                  <span className="info-pillar-range">{pillar.range}</span>
                </div>
                <p>{pillar.description}</p>
              </div>
            ))}
          </div>

          {areteScore != null && (
            <span className="info-current-chip">
              Tu Ataraxia actual: {areteScore}% · {currentPillar}
            </span>
          )}
        </section>

        <section className="info-modal-section">
          <h3>Virtus y la Carga del Rango</h3>
          <p>
            Virtus es tu progreso acumulado como trader. Cada acción disciplinada suma puntos; cada ruptura de tu
            plan los resta. A medida que acumulas puntos avanzas por 5 niveles inspirados en la filosofía griega —
            nunca bajan por el paso del tiempo, solo reflejan tu historial de disciplina.
          </p>

          <div className="info-stage-list">
            {stageBadges.map((badge) => (
              <div key={badge.level} className={`info-stage-row ${badge.level === currentStageLevel ? 'current' : ''}`}>
                <span className="info-stage-name">{badge.level}</span>
                <span className="info-stage-desc">{badge.name}</span>
                <span className="info-stage-range">{badge.range}</span>
              </div>
            ))}
          </div>

          {virtusTotal !== undefined && (
            <span className="info-current-chip">
              Tu total actual: {virtusTotal.toLocaleString('es-ES')} pts · {currentStageLevel}
              {currentRankMultiplier !== undefined && currentRankMultiplier > 1 && (
                <> · penalizaciones ×{currentRankMultiplier}</>
              )}
            </span>
          )}

          <p>
            <strong>La Carga del Rango:</strong> entre más alto tu rango, más exigente es el estándar. Los mismos
            errores duelen distinto según dónde estés parado — en Logos y Ethos las penalizaciones son normales
            (×1.0), en Praxis se multiplican ×1.2, y en Kairos y Omega llegan a ×1.5. Un trader Kairos que rompe su
            plan pierde bastante más Virtus que uno que apenas empieza en Logos: se espera más de quien ya sabe más.
          </p>

          <h4>Puntos base — cómo ganas y pierdes</h4>
          <p className="hint-text">
            Estos son los valores base. El resultado final de cada sesión puede variar: sube ×1.2 si mantienes una
            Racha de Flujo (Ataraxia), y las penalizaciones se multiplican por la Carga del Rango y, si operaste en
            Tilt, por ×1.5 adicional.
          </p>
          <ul className="info-points-list">
            {virtusPointRules.map((rule) => (
              <li key={rule.label}>
                <span className={`info-points-value ${rule.points > 0 ? 'positive' : 'negative'}`}>
                  {rule.points > 0 ? '+' : ''}
                  {rule.points}
                </span>
                <span>{rule.label}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}

export default ProgressInfoModal;
