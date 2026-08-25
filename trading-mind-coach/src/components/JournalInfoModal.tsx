import { useEffect } from 'react';

function JournalInfoModal({ open, onClose }: { open: boolean; onClose: () => void }) {
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
          <h2>Cómo funciona el Journal</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Cerrar">
            ✕
          </button>
        </div>

        <section className="info-modal-section">
          <h3>La idea general</h3>
          <p>
            El Journal es tu registro diario de trading, dividido en <strong>3 fases secuenciales</strong>: Pre-sesión,
            Ejecución y Post-mercado. Cada fase se llena y se <strong>sella por separado</strong> — una vez sellada,
            esos campos quedan congelados para siempre y no se pueden editar. La idea es que registres lo que pensabas
            <em> antes</em> de operar, lo que hiciste <em>durante</em>, y lo que analizaste <em>después</em>, sin poder
            reescribir tu historia una vez conoces el resultado.
          </p>
          <p>
            Solo puedes avanzar a la fase siguiente una vez sellaste la anterior, y solo puedes sellar el registro
            final cuando completaste el Quiz Post-Mercado y el análisis técnico. Si dejas un día sin sellar por
            completo, la app no te deja crear el journal del día siguiente hasta que lo termines — Buzón y el badge
            del menú lateral te lo recuerdan.
          </p>
        </section>

        <section className="info-modal-section">
          <h3>Paso a paso</h3>
          <ol className="info-points-list info-steps-list">
            <li>
              <strong>Fase 1 · Pre-sesión:</strong> elige la fecha, tu estado emocional, escribe tu Directriz
              Operativa (el plan del día), define tu Top-Down (HTF/LTF) y tu Draw on Liquidity (contexto, DOL objetivo
              y punto de invalidación). Aquí también agregas capturas de pantalla y puedes compartir la entrada.
              Cuando esté lista, pulsa <strong>«Sellar Análisis»</strong>.
            </li>
            <li>
              <strong>Fase 2 · Ejecución:</strong> indica si tomaste un trade o no. Si sí, agrega una fila por cada
              operación (símbolo, dirección, modelo/setup, calidad, sesión, entry, stop, take profit, R:R, P&L,
              resultado y la lección que te deja). Cada operación exige además al menos una{' '}
              <strong>captura de pantalla del setup ejecutado</strong> — es obligatoria para poder sellar esta fase, así
              construyes un historial visual que te ayuda a detectar errores y aciertos con el tiempo. Cuando
              termines, pulsa <strong>«Sellar Ejecución»</strong>.
            </li>
            <li>
              <strong>Fase 3 · Post-mercado:</strong> escribe tu análisis técnico post-mercado y responde el Quiz
              Post-Mercado completo. El botón final <strong>«Sellar Registro»</strong> se activa (y brilla) solo
              cuando todo el quiz y el análisis están completos.
            </li>
            <li>
              Al sellar el registro, la app te muestra tu <strong>Ataraxia del día</strong>: qué sumó y qué restó,
              para que cierres la sesión con feedback honesto sobre tu propia disciplina.
            </li>
          </ol>
        </section>

        <section className="info-modal-section">
          <h3>Personalizar el journal</h3>
          <p>
            Los modelos/setups, escenarios y el resto de las opciones que ves al llenar el journal salen de lo que
            configures en <strong>Manual Operativo</strong>. Si agregas o cambias un setup ahí, aparece automáticamente
            como opción dentro de tus operaciones en el Journal — no hay que tocar nada más.
          </p>
        </section>

        <section className="info-modal-section">
          <h3>Guardar capturas de pantalla</h3>
          <p>
            En la Fase 1, dentro de «Capturas de pantalla», puedes arrastrar una imagen, elegirla desde tu equipo, o
            simplemente pegarla con <strong>Ctrl+V</strong> después de copiarla (por ejemplo, desde TradingView).
            Puedes subir hasta 10 capturas por journal, y quitarlas mientras la Fase 1 siga sin sellar.
          </p>
          <p>
            En la Fase 2, cada operación tiene su propio bloque de capturas — funciona igual (arrastrar, elegir
            archivo o Ctrl+V) pero está pensado para el setup específico de esa operación, y{' '}
            <strong>al menos una captura por operación es obligatoria</strong> para poder sellar la Fase 2.
          </p>
        </section>

        <section className="info-modal-section">
          <h3>Enviar tu journal</h3>
          <p>
            En la Fase 1 hay dos tarjetas de envío: <strong>Fraternidad</strong>, para compartir la entrada con un
            amigo puntual y recibir su feedback, y <strong>Ágora</strong>, para compartirla de una vez con todos los
            miembros de un grupo. Ambas funcionan aunque el journal ya esté sellado — compartir es siempre una acción
            de solo lectura, nunca modifica lo que ya registraste.
          </p>
        </section>

        <section className="info-modal-section">
          <h3>El Quiz Post-Mercado</h3>
          <p>
            Audita tu propia ejecución del día: si tu bias fue correcto, si se liquidó tu DOL, cómo estuvo tu lectura
            del precio, si respetaste tu narrativa y tu manejo de riesgo, si el setup cumplió los parámetros, y cómo
            fue tu psicología durante el trade. Cada respuesta influye en tu Ataraxia del día y en tus puntos Virtus —
            respóndelo con la misma honestidad con la que llenaste la Fase 1, antes de saber el resultado.
          </p>
        </section>

        <section className="info-modal-section">
          <h3>Revisitar journals pasados</h3>
          <p>
            Usa <strong>Historial</strong> para navegar el calendario y abrir cualquier día anterior en modo lectura.
            Los journals que te comparten aparecen en tu <strong>Buzón</strong>, y dentro de cada <strong>Ágora</strong>{' '}
            hay una pestaña «Journals» con filtros por usuario y por fecha — útil para retomarlos en una sesión de
            feedback grupal.
          </p>
        </section>
      </div>
    </div>
  );
}

export default JournalInfoModal;
