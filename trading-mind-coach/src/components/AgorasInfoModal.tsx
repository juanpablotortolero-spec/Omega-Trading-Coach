import { useEffect } from 'react';

function AgorasInfoModal({ open, onClose }: { open: boolean; onClose: () => void }) {
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

  return (
    <div className="info-modal-backdrop" onClick={onClose}>
      <div className="info-modal-panel" onClick={(event) => event.stopPropagation()}>
        <div className="info-modal-header">
          <h2>Cómo funcionan las Ágoras</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Cerrar">
            ✕
          </button>
        </div>

        <section className="info-modal-section">
          <h3>Círculos cerrados de traders</h3>
          <p>
            Una Ágora es un grupo privado — creá la tuya con un nombre, o buscá una existente y pedí unirte (el
            dueño aprueba cada solicitud). Adentro tenés miembros, mensajes, journals compartidos con todo el grupo
            de una vez, y archivos.
          </p>
        </section>

        <section className="info-modal-section">
          <h3>Auditar en conjunto</h3>
          <p>
            A diferencia de compartir un journal puntual con un amigo en Fraternidad, en una Ágora lo compartís con
            todos los miembros a la vez — pensado para revisiones grupales, mentorías o comparar progreso entre
            varios traders del mismo círculo.
          </p>
        </section>
      </div>
    </div>
  );
}

export default AgorasInfoModal;
