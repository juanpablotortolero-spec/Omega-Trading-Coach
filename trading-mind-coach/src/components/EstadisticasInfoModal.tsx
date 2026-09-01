import { useEffect } from 'react';

function EstadisticasInfoModal({ open, onClose }: { open: boolean; onClose: () => void }) {
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
          <h2>Cómo funcionan las Estadísticas</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Cerrar">
            ✕
          </button>
        </div>

        <section className="info-modal-section">
          <h3>Números reales, no proyecciones</h3>
          <p>
            Todo lo que ves acá sale directamente de las operaciones que registraste en tu Journal — nada se estima
            ni se completa artificialmente. Si un período no tiene operaciones, esa sección simplemente aparece
            vacía en vez de mostrar un dato inventado.
          </p>
        </section>

        <section className="info-modal-section">
          <h3>Filtro de período</h3>
          <p>
            El selector de arriba (día, semana, mes, año, general) recalcula todas las métricas de la página sobre
            esa ventana de tiempo — winrate, P&L, ejecuciones por modelo y tu curva de Ataraxia.
          </p>
        </section>

        <section className="info-modal-section">
          <h3>Modelos y Winrate</h3>
          <p>
            Agrupa tus operaciones por el setup/modelo que marcaste en el Journal, mostrando cuántas veces lo
            ejecutaste y qué porcentaje terminó en TP. Te sirve para ver qué setups te están funcionando de verdad,
            no solo cuáles sentís que funcionan.
          </p>
        </section>

        <section className="info-modal-section">
          <h3>Curva de Ataraxia</h3>
          <p>
            Muestra la evolución de tu disciplina de ejecución día a día en el rango elegido — te permite ver si tu
            consistencia mejora, empeora o es errática a lo largo del tiempo, más allá del resultado en dinero de
            cada sesión.
          </p>
        </section>
      </div>
    </div>
  );
}

export default EstadisticasInfoModal;
