import { useEffect } from 'react';

function TradingPlanInfoModal({ open, onClose }: { open: boolean; onClose: () => void }) {
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
          <h2>Cómo funciona el Manual Operativo</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Cerrar">
            ✕
          </button>
        </div>

        <section className="info-modal-section">
          <h3>Es el plan contra el que Omega te audita</h3>
          <p>
            Todo lo que escribas acá — tu gestión de riesgo, tus reglas psicológicas, tus días sin operar, tus
            ventanas horarias, tus setups — es lo que Omega usa como vara de medir cada sesión. No es un documento
            decorativo: cada ruptura de plan que Omega detecta en tu journal viene de comparar lo que hiciste contra
            lo que escribiste acá.
          </p>
          <p>Se guarda automáticamente mientras escribes — no hace falta ningún botón de «guardar».</p>
        </section>

        <section className="info-modal-section">
          <h3>Pestaña Plan</h3>
          <p>
            Tu perfil como trader, tus setups (con su win-rate histórico y mejores días), tu gestión de riesgo, tus
            reglas psicológicas, tus días sin operar, tu plan ante rachas negativas y tus metas — manuales (las
            controlas vos con un slider) o automáticas (Omega ajusta su progreso según evidencia real).
          </p>
        </section>

        <section className="info-modal-section">
          <h3>Pestaña Personalización</h3>
          <p>
            Define la plantilla de tu Journal: qué escenarios de Top-Down usas, qué preguntas querés que aparezcan en
            tu Quiz Post-Mercado. Los setups que agregues acá aparecen automáticamente como opción al registrar
            operaciones en el Journal.
          </p>
        </section>
      </div>
    </div>
  );
}

export default TradingPlanInfoModal;
