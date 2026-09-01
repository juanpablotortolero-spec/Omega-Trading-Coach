import { useEffect } from 'react';

function SocialInfoModal({ open, onClose }: { open: boolean; onClose: () => void }) {
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
          <h2>Cómo funciona Fraternidad</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Cerrar">
            ✕
          </button>
        </div>

        <section className="info-modal-section">
          <h3>Amigos reales, no seguidores</h3>
          <p>
            Buscá a un amigo por su correo y mandale una solicitud — cuando la acepta, aparece en tu lista con su
            rango Virtus actual y si está online en este momento. No hay likes ni feed público: es un vínculo
            directo, uno a uno.
          </p>
        </section>

        <section className="info-modal-section">
          <h3>Compartir tu journal</h3>
          <p>
            Desde la Fase 1 de cualquier journal podés enviárselo a un amigo puntual para que te dé feedback — le
            llega a su Buzón. Es siempre una acción de solo lectura: compartir nunca modifica lo que ya registraste.
          </p>
        </section>
      </div>
    </div>
  );
}

export default SocialInfoModal;
