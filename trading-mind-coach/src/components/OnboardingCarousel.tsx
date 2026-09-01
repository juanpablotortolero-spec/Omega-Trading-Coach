import { useState } from 'react';
import { requestNotificationPermission } from '../lib/desktopNotifications';
import OmegaMark from './OmegaMark';

type Callout = { top: string; left: string; text: string };

type Slide = {
  key: string;
  title: string;
  body: string;
  image: string;
  callouts: Callout[];
};

/**
 * Las posiciones de los callouts (top/left en %) son aproximadas — pensadas
 * para encajar con capturas reales típicas de cada pantalla. Una vez que las
 * capturas reales estén cableadas en public/assets/onboarding/, conviene
 * ajustar estos porcentajes mirando cada imagen final.
 */
const SLIDES: Slide[] = [
  {
    key: 'dashboard',
    title: 'Inicio',
    body: 'Tu centro de mando: tu rango Virtus, tu Ataraxia del día, tus misiones activas y el calendario de tus journals — todo en una sola vista.',
    image: '/assets/onboarding/dashboard.png',
    callouts: [
      { top: '37%', left: '48%', text: 'Misiones de Hoy — lo que te propongo cumplir en el día a día.' },
      { top: '31%', left: '84%', text: 'Tu rango, tu XP y tu Ataraxia real — nunca se inventan, salen de tu journal.' },
    ],
  },
  {
    key: 'journal',
    title: 'Nuevo Journal',
    body: 'Tu registro diario en 3 fases: Pre-sesión, Ejecución y Post-mercado. Cada fase se sella por separado — una vez sellada, queda congelada para siempre.',
    image: '/assets/onboarding/journal.png',
    callouts: [
      { top: '60%', left: '58%', text: 'Directriz operativa: escribí tu plan ANTES de operar, no después.' },
      { top: '80%', left: '85%', text: 'Elegí en qué UTC ver las horas de las noticias económicas.' },
    ],
  },
  {
    key: 'manual',
    title: 'Manual Operativo',
    body: 'El corazón de tu sistema. Tu gestión de riesgo, tus reglas psicológicas y tus setups — es exactamente lo que yo uso para auditar cada sesión tuya.',
    image: '/assets/onboarding/manual-operativo.png',
    callouts: [
      { top: '30%', left: '26%', text: 'Plan y Personalización — tus reglas y tu plantilla de journal.' },
      { top: '15%', left: '85%', text: 'Todo se guarda solo, mientras escribís — sin botón de guardar.' },
    ],
  },
  {
    key: 'estadisticas',
    title: 'Estadísticas',
    body: 'Números reales de tu ejecución — nunca proyecciones. Winrate por modelo, P&L y tu curva de Ataraxia en el tiempo.',
    image: '/assets/onboarding/estadisticas.png',
    callouts: [{ top: '13%', left: '85%', text: 'Filtrá por día, semana, mes, año o todo tu historial.' }],
  },
  {
    key: 'omega-coach',
    title: 'Omega Coach',
    body: 'Tu centro de mando conmigo: briefing antes de operar, tu estado psicológico, mi análisis de tu sesión y las misiones que te voy dejando.',
    image: '/assets/onboarding/omega-coach.png',
    callouts: [
      { top: '16%', left: '41%', text: '4 pestañas — las últimas 3 se destraban al sellar tu journal del día.' },
      { top: '80%', left: '58%', text: 'Aceptá el plan de acción de hoy para cerrar el briefing.' },
    ],
  },
  {
    key: 'historial',
    title: 'Historial',
    body: 'Tu bitácora completa. Tocá cualquier día para ver o retomar ese journal, y revisá tus semanas y meses pasados de un vistazo.',
    image: '/assets/onboarding/historial.png',
    callouts: [{ top: '13%', left: '85%', text: 'Cambiá entre vista de Mes o de Año.' }],
  },
  {
    key: 'buzon',
    title: 'Buzón',
    body: 'Tus solicitudes de amistad, las invitaciones a Ágoras y los journals que te comparten — todo llega acá.',
    image: '/assets/onboarding/buzon.png',
    callouts: [{ top: '29%', left: '58%', text: 'Solicitudes de amistad y de Ágoras pendientes.' }],
  },
  {
    key: 'fraternidad',
    title: 'Fraternidad',
    body: 'Agregá amigos reales, comparen su progreso y mándense feedback directo sobre sus journals.',
    image: '/assets/onboarding/fraternidad.png',
    callouts: [{ top: '16%', left: '79%', text: 'Agregá un amigo por su correo.' }],
  },
  {
    key: 'agoras',
    title: 'Ágoras',
    body: 'Círculos cerrados de traders. Creá el tuyo o unite a uno para compartir tu journal con todo el grupo de una vez.',
    image: '/assets/onboarding/agoras.png',
    callouts: [{ top: '39%', left: '58%', text: 'Creá tu propia Ágora con un nombre.' }],
  },
  {
    key: 'conexiones',
    title: 'Conexiones',
    body: 'Tus cuentas de fondeo reales. Vinculá tus operaciones a una cuenta y el balance se ajusta solo al sellar — yo vigilo el drawdown de cada una.',
    image: '/assets/onboarding/conexiones.png',
    callouts: [{ top: '14%', left: '87%', text: 'Registrá tu primera cuenta acá.' }],
  },
];

function SlideMedia({ image, callouts }: { image: string; callouts: Callout[] }) {
  const [failed, setFailed] = useState(false);

  return (
    <div className="onboarding-media">
      {!failed ? (
        <img src={image} alt="" onError={() => setFailed(true)} />
      ) : (
        <div className="onboarding-media-fallback">Ω</div>
      )}
      {!failed &&
        callouts.map((callout, index) => (
          <div key={index} className="onboarding-callout" style={{ top: callout.top, left: callout.left }}>
            {callout.text}
          </div>
        ))}
    </div>
  );
}

function OnboardingCarousel({ onClose }: { onClose: () => void }) {
  const [index, setIndex] = useState(0);
  const [notifState, setNotifState] = useState<'idle' | 'asked'>('idle');
  const total = SLIDES.length + 1; // +1 por la slide final de notificaciones
  const isCtaSlide = index === SLIDES.length;

  const goNext = () => setIndex((current) => Math.min(current + 1, total - 1));
  const goBack = () => setIndex((current) => Math.max(current - 1, 0));

  const handleEnableNotifications = async () => {
    await requestNotificationPermission();
    setNotifState('asked');
  };

  return (
    <div className="onboarding-backdrop">
      <div className="onboarding-panel">
        <div className="onboarding-eyebrow-row">
          <OmegaMark size={28} />
          <button type="button" className="onboarding-skip-btn" onClick={onClose}>
            Saltar introducción
          </button>
        </div>

        {!isCtaSlide ? (
          <>
            <SlideMedia image={SLIDES[index].image} callouts={SLIDES[index].callouts} />
            <div className="onboarding-body">
              <h2>{SLIDES[index].title}</h2>
              <p>{SLIDES[index].body}</p>
            </div>
          </>
        ) : (
          <div className="onboarding-cta-slide">
            <OmegaMark size={64} />
            <h2 style={{ fontFamily: "'Cinzel', serif", color: 'var(--accent-gold)', margin: 0 }}>
              Una última cosa
            </h2>
            <p style={{ maxWidth: 440, lineHeight: 1.6 }}>
              Puedo avisarte por notificación de escritorio cuando tu briefing esté listo, cuando termine de auditar
              tu sesión, si te olvidás de sellar tu journal, si alguien te comparte el suyo, o si una cuenta se
              acerca a su límite de pérdida.
            </p>
            {notifState === 'idle' ? (
              <button type="button" className="primary-btn btn-sm" onClick={handleEnableNotifications}>
                Activar notificaciones de escritorio
              </button>
            ) : (
              <p className="hint-text">Listo — podés cambiarlo cuando quieras desde el menú lateral.</p>
            )}
          </div>
        )}

        <div className="onboarding-footer">
          <div className="onboarding-dots">
            {Array.from({ length: total }, (_, i) => (
              <span key={i} className={`onboarding-dot ${i === index ? 'active' : ''}`} />
            ))}
          </div>
          <div className="onboarding-nav-actions">
            {index > 0 && (
              <button type="button" className="ghost-btn btn-sm" onClick={goBack}>
                Atrás
              </button>
            )}
            {!isCtaSlide ? (
              <button type="button" className="primary-btn btn-sm" onClick={goNext}>
                Siguiente
              </button>
            ) : (
              <button type="button" className="primary-btn btn-sm" onClick={onClose}>
                Empezar
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default OnboardingCarousel;
