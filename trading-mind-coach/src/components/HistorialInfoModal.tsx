import { useEffect } from 'react';

function HistorialInfoModal({ open, onClose }: { open: boolean; onClose: () => void }) {
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
          <h2>Cómo funciona el Historial</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Cerrar">
            ✕
          </button>
        </div>

        <section className="info-modal-section">
          <h3>Tu bitácora completa</h3>
          <p>
            Cada día que registraste (o que dejaste sin registrar) aparece acá. Tocá cualquier día del calendario
            para abrir ese journal — si ya existe, lo ves en modo lectura o lo seguís completando si quedó a medias;
            si no existe, empezás uno nuevo para esa fecha.
          </p>
        </section>

        <section className="info-modal-section">
          <h3>Vista Mes / Año</h3>
          <p>
            El toggle de arriba cambia entre ver un mes completo con detalle diario, o el año entero resumido mes a
            mes — útil para detectar rachas o baches de constancia de un vistazo, sin tener que navegar mes por mes.
          </p>
        </section>
      </div>
    </div>
  );
}

export default HistorialInfoModal;
