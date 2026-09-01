import { useEffect } from 'react';

function BuzonInfoModal({ open, onClose }: { open: boolean; onClose: () => void }) {
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
          <h2>Cómo funciona el Buzón</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Cerrar">
            ✕
          </button>
        </div>

        <section className="info-modal-section">
          <h3>Toda tu correspondencia, en un lugar</h3>
          <p>
            Acá llegan tres cosas: las solicitudes de amistad que te mandaron, las solicitudes para unirse a un
            Ágora tuyo, y los journals que tus amigos te comparten directamente. Aceptar o rechazar una solicitud se
            hace desde acá mismo, sin salir de la pantalla.
          </p>
        </section>

        <section className="info-modal-section">
          <h3>Journals compartidos</h3>
          <p>
            Cada journal que te comparten queda listado con quién lo mandó y de qué fecha es — tocalo para abrirlo
            en modo lectura. Podés filtrar por amigo o por fecha si la lista crece.
          </p>
        </section>
      </div>
    </div>
  );
}

export default BuzonInfoModal;
