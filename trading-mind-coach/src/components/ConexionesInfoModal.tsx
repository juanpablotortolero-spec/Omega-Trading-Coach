import { useEffect } from 'react';

function ConexionesInfoModal({ open, onClose }: { open: boolean; onClose: () => void }) {
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
          <h2>Cómo funciona Conexiones</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Cerrar">
            ✕
          </button>
        </div>

        <section className="info-modal-section">
          <h3>Tus cuentas de fondeo, todas en un lugar</h3>
          <p>
            Registra cada cuenta (evaluación o financiada) con su balance inicial, meta de profit, límite de
            drawdown (MLL) y, si aplica, su límite de pérdida diaria (DLL). La barra de cada tarjeta te muestra
            dónde estás parado entre el límite de pérdida y la meta.
          </p>
        </section>

        <section className="info-modal-section">
          <h3>Balance automático desde el Journal</h3>
          <p>
            Cuando registrás una operación en el Journal, podés vincularla a una o más de tus cuentas activas. Al
            sellar la Fase 2 (Ejecución), el P&L de esa operación se suma o resta automáticamente al balance de cada
            cuenta vinculada — no hace falta actualizar el balance a mano, aunque el botón <strong>«Actualizar
            Balance»</strong> sigue disponible para ajustes manuales.
          </p>
        </section>

        <section className="info-modal-section">
          <h3>Gestor de Riesgo, en Omega Coach</h3>
          <p>
            Cada movimiento de balance queda en un historial que alimenta el panel <strong>«Gestor de Riesgo»</strong>{' '}
            dentro del Tab Estado de Omega Coach — ahí ves el % de distancia consumida hacia tu límite de pérdida y
            la tendencia de los últimos días. Si una cuenta cruza el 80% de esa distancia, Omega te lo advierte
            activamente.
          </p>
        </section>
      </div>
    </div>
  );
}

export default ConexionesInfoModal;
