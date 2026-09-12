import { useEffect } from 'react';
import type { HeadCoachAuditLike } from '../lib/omegaCoachTemplates';
import AtaraxiaBar from './AtaraxiaBar';
import OmegaMark from './OmegaMark';

function SessionSealedModal({
  open,
  onClose,
  score,
  positives,
  negatives,
  audit,
}: {
  open: boolean;
  onClose: () => void;
  score: number | null;
  positives: string[];
  negatives: string[];
  audit: HeadCoachAuditLike | null;
}) {
  useEffect(() => {
    if (!open) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  // Congela el scroll del fondo mientras el modal está abierto — mismo
  // patrón que ProgressInfoModal.
  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="info-modal-backdrop" onClick={onClose}>
      <div className="info-modal-panel" onClick={(event) => event.stopPropagation()}>
        <div className="info-modal-header">
          <h2>Tu sesión ha terminado</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Cerrar">
            ✕
          </button>
        </div>

        <section className="info-modal-section">
          <p>
            Tu journal quedó sellado — este es el registro honesto de cómo se vio, cómo se ejecutó y cómo te
            sentiste hoy. Ya no se puede editar, para que tu progreso se mida sobre lo que realmente pasó.
          </p>

          <AtaraxiaBar score={score} />

          {score !== null && (
            <div className="arete-breakdown">
              {positives.length > 0 && (
                <div className="arete-col">
                  <span className="eyebrow">Lo que sumó</span>
                  <ul>
                    {positives.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              )}
              {negatives.length > 0 && (
                <div className="arete-col">
                  <span className="eyebrow">Lo que restó</span>
                  <ul>
                    {negatives.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          <p className="hint-text" style={{ marginTop: 16 }}>
            Mantén lo que sumó, enfócate activamente en corregir lo que restó — así se ve el progreso real, sesión
            tras sesión.
          </p>
        </section>

        <section className="info-modal-section omega-verdict-card">
          <div className="oraculo-header">
            <OmegaMark size={32} />
            <div>
              <h3>Veredicto de Omega</h3>
              <span className="hint-text">Auditoría de tu ejecución de hoy</span>
            </div>
          </div>

          {audit ? (
            <>
              <p className="oraculo-text">{audit.daily_feedback}</p>
              <div className="arete-breakdown">
                {audit.strengths.length > 0 && (
                  <div className="arete-col">
                    <span className="eyebrow">Se hizo bien</span>
                    <ul>
                      {audit.strengths.map((item) => (
                        <li key={item.behavior}>{item.behavior}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {audit.weaknesses.length > 0 && (
                  <div className="arete-col">
                    <span className="eyebrow">Se hizo mal</span>
                    <ul>
                      {audit.weaknesses.map((item) => (
                        <li key={item.behavior}>{item.behavior}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </>
          ) : (
            <p className="hint-text">Omega no emitió un veredicto estructurado para esta sesión.</p>
          )}
        </section>

        <div className="journal-submit-row" style={{ marginTop: 20 }}>
          <button type="button" className="primary-btn btn-sm" onClick={onClose}>
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
}

export default SessionSealedModal;
