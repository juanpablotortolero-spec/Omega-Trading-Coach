import { useEffect } from 'react';

function OmegaDashboardInfoModal({ open, onClose }: { open: boolean; onClose: () => void }) {
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
          <h2>Cómo funciona Omega Coach</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Cerrar">
            ✕
          </button>
        </div>

        <section className="info-modal-section">
          <h3>Tu centro de mando con Omega</h3>
          <p>
            Acá vive todo lo que Omega genera para vos, organizado en 4 pestañas. Las 3 últimas se destraban recién
            cuando sellás por completo tu journal del día — la auditoría automática necesita esa evidencia real para
            no inventar un veredicto.
          </p>
        </section>

        <section className="info-modal-section">
          <h3>Briefing Pre-Sesión</h3>
          <p>
            Un análisis proactivo, antes de operar, cruzando tu Manual Operativo, tu tendencia reciente de Virtus y
            las noticias de alto impacto del día. Debajo, el calendario histórico te deja abrir cualquier briefing
            pasado y generar tu Auditoría Semanal (se habilita al cerrar la semana) o tu Auditoría Mensual.
          </p>
        </section>

        <section className="info-modal-section">
          <h3>Estado</h3>
          <p>
            Tu Juego A/B/C del día, qué sumó y qué restó a tu Virtus hoy, y el panel de <strong>Gestor de
            Riesgo</strong> — el % de distancia consumida hacia el límite de pérdida de cada una de tus cuentas de
            fondeo activas, con su tendencia reciente.
          </p>
        </section>

        <section className="info-modal-section">
          <h3>Conversación</h3>
          <p>
            El feedback textual de Omega sobre tu última sesión, junto a tus fortalezas y fugas de capital
            identificadas — la lectura psicológica de cómo operaste.
          </p>
        </section>

        <section className="info-modal-section">
          <h3>Objetivos</h3>
          <p>
            Tus misiones activas asignadas por Omega (algunas piden una respuesta escrita de reflexión — Omega la
            lee y decide si ameritó avance real) y tus metas automáticas del Manual Operativo, con el progreso real
            que Omega les fue acreditando.
          </p>
        </section>
      </div>
    </div>
  );
}

export default OmegaDashboardInfoModal;
