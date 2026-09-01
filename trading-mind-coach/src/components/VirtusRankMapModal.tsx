import { useEffect } from 'react';
import { currentStage, stageBadges } from '../lib/virtus';
import VirtusIcon, { type VirtusLevel } from './VirtusIcon';

function VirtusRankMapModal({
  open,
  onClose,
  virtusTotal,
}: {
  open: boolean;
  onClose: () => void;
  virtusTotal: number;
}) {
  useEffect(() => {
    if (!open) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  if (!open) return null;

  const currentLevel = currentStage(virtusTotal).level;

  return (
    <div className="info-modal-backdrop" onClick={onClose}>
      <div className="info-modal-panel recap-modal-panel" onClick={(event) => event.stopPropagation()}>
        <div className="info-modal-header">
          <h2>Mapa de Rangos Virtus</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Cerrar">
            ✕
          </button>
        </div>

        <section className="info-modal-section">
          <p>
            Cinco escalones, inspirados en la filosofía estoica. Cada uno se desbloquea solo con disciplina
            sostenida — nunca por el paso del tiempo. Los que todavía no alcanzaste quedan ocultos: una razón más
            para seguir.
          </p>

          <div className="virtus-map-grid">
            {stageBadges.map((badge) => {
              const unlocked = virtusTotal >= badge.minPoints;
              const isCurrent = badge.level === currentLevel;
              return (
                <div
                  key={badge.level}
                  className={`virtus-map-card ${badge.accent} ${unlocked ? '' : 'locked'} ${isCurrent ? 'current' : ''}`}
                >
                  {isCurrent && <span className="virtus-map-current-tag">Tu rango actual</span>}
                  <div className="virtus-map-icon-wrap">
                    <VirtusIcon level={badge.level as VirtusLevel} className="virtus-map-icon" />
                    {!unlocked && (
                      <span className="virtus-map-lock" aria-hidden="true">
                        🔒
                      </span>
                    )}
                  </div>
                  <span className="virtus-map-name">{unlocked ? badge.level : '???'}</span>
                  {unlocked ? (
                    <span className="virtus-map-range">{badge.range}</span>
                  ) : (
                    <span className="virtus-map-range">Todavía sin descubrir</span>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}

export default VirtusRankMapModal;
