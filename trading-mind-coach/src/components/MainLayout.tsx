import { useEffect, useState, type CSSProperties } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useMailbox } from '../contexts/MailboxContext';
import { MedalProvider } from '../contexts/MedalContext';
import { OmegaProvider } from '../contexts/OmegaContext';
import { useRefresh } from '../contexts/RefreshContext';
import { getTodayBriefingAckStatus, getWeeklyKillSwitchStatus, touchPresence } from '../lib/api';
import { localIsoDate } from '../lib/calendar';
import { getNotificationPermission, requestNotificationPermission, type NotificationPermissionState } from '../lib/desktopNotifications';
import { useDesktopNotifications } from '../hooks/useDesktopNotifications';
import MedalUnlockToast from './MedalUnlockToast';
import OmegaAlertModal from './OmegaAlertModal';
import OmegaChat from './OmegaChat';
import OmegaMark from './OmegaMark';
import OnboardingCarousel from './OnboardingCarousel';

const navItems = [
  { label: 'Inicio', path: '/dashboard' },
  { label: 'Omega Coach', path: '/omega-coach' },
  { label: 'Nuevo journal', path: '/journal/nuevo' },
  { label: 'Historial', path: '/historial' },
  { label: 'Estadísticas', path: '/estadisticas' },
  { label: 'Manual operativo', path: '/manual-operativo' },
  { label: 'Buzón', path: '/buzon' },
  { label: 'Fraternidad', path: '/social' },
  { label: 'Ágoras', path: '/agoras' },
  { label: 'Conexiones', path: '/conexiones' },
];

const PRESENCE_HEARTBEAT_MS = 60 * 1000;

const emberGradients = [
  'radial-gradient(circle, rgba(255,180,90,0.9), rgba(201,90,30,0.35) 55%, rgba(201,90,30,0) 75%)',
  'radial-gradient(circle, rgba(255,140,60,0.85), rgba(170,60,20,0.3) 55%, rgba(170,60,20,0) 75%)',
  'radial-gradient(circle, rgba(255,210,120,0.8), rgba(201,120,40,0.25) 55%, rgba(201,120,40,0) 75%)',
];

/**
 * Computed once at module load (not per render) so the rising embers don't
 * reset position on every state update across the app shell.
 */
const emberParticles = Array.from({ length: 42 }, () => {
  // Squaring the random factor skews sizes toward the small end, so most
  // embers are tiny specks and only a few are noticeably bigger — mirrors
  // how real sparks vary instead of a uniform glowing dot pattern.
  const size = 2 + Math.pow(Math.random(), 2) * 6;
  return {
    left: Math.random() * 100,
    delay: Math.random() * 14,
    duration: 7 + Math.random() * 9,
    size,
    glow: size * (1.1 + Math.random() * 0.6),
    glowOpacity: 0.22 + Math.random() * 0.18,
    drift: Math.random() * 50 - 25,
    rise: 95 + Math.random() * 60,
    gradient: emberGradients[Math.floor(Math.random() * emberGradients.length)],
  };
});

function MainLayout() {
  const { user, signOut } = useAuth();
  const { version } = useRefresh();
  const { pendingRequests, mailboxCount } = useMailbox();
  const location = useLocation();
  const [navOpen, setNavOpen] = useState(false);
  const [journalLocked, setJournalLocked] = useState(false);
  const [hasUnreadBriefing, setHasUnreadBriefing] = useState(false);
  const [notifPermission, setNotifPermission] = useState<NotificationPermissionState>('default');
  const [showOnboarding, setShowOnboarding] = useState(false);

  useDesktopNotifications();

  useEffect(() => {
    setNotifPermission(getNotificationPermission());
  }, []);

  const handleEnableNotifications = async () => {
    const result = await requestNotificationPermission();
    setNotifPermission(result);
  };

  // Se muestra una sola vez por usuario — se marca "visto" recién al
  // cerrarlo, así un refresh a mitad del carrusel no lo pierde.
  useEffect(() => {
    if (!user) return;
    try {
      const seen = localStorage.getItem(`omega_onboarding_seen_${user.id}`);
      if (!seen) setShowOnboarding(true);
    } catch {
      // localStorage no disponible — se omite el onboarding en vez de romper la app.
    }
  }, [user]);

  const handleCloseOnboarding = () => {
    setShowOnboarding(false);
    if (!user) return;
    try {
      localStorage.setItem(`omega_onboarding_seen_${user.id}`, '1');
    } catch {
      // Si falla, en la próxima visita simplemente se vuelve a mostrar.
    }
  };

  useEffect(() => {
    setNavOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    getWeeklyKillSwitchStatus(user.id, new Date()).then((status) => {
      if (!cancelled) setJournalLocked(status.triggered !== null);
    });

    return () => {
      cancelled = true;
    };
  }, [user, version]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    getTodayBriefingAckStatus(user.id, localIsoDate(new Date())).then((status) => {
      if (!cancelled) setHasUnreadBriefing(status.exists && !status.acknowledged);
    });

    return () => {
      cancelled = true;
    };
  }, [user, version]);

  useEffect(() => {
    if (!user) return;

    touchPresence(user.id).catch(() => {});
    const interval = setInterval(() => {
      touchPresence(user.id).catch(() => {});
    }, PRESENCE_HEARTBEAT_MS);

    return () => clearInterval(interval);
  }, [user]);

  return (
    <OmegaProvider>
    <MedalProvider>
      <div className="ember-field" aria-hidden="true">
        {emberParticles.map((particle, index) => (
          <span
            key={index}
            className="ember-particle"
            style={
              {
                left: `${particle.left}%`,
                width: `${particle.size}px`,
                height: `${particle.size}px`,
                background: particle.gradient,
                boxShadow: `0 0 ${particle.glow}px rgba(255, 130, 60, ${particle.glowOpacity})`,
                animationDelay: `${particle.delay}s`,
                animationDuration: `${particle.duration}s`,
                '--drift-x': `${particle.drift}px`,
                '--rise': `-${particle.rise}vh`,
              } as CSSProperties
            }
          />
        ))}
      </div>

      <div className="app-shell">
      <header className="mobile-topbar">
        <div className="brand-block">
          <div className="brand-mark">
            <OmegaMark size={30} />
          </div>
          <p className="eyebrow">Ágora Nocturna</p>
        </div>
        <button
          type="button"
          className="mobile-nav-toggle"
          onClick={() => setNavOpen((open) => !open)}
          aria-label="Abrir menú"
          aria-expanded={navOpen}
        >
          <span />
          <span />
          <span />
        </button>
      </header>

      {navOpen && <div className="mobile-nav-backdrop" onClick={() => setNavOpen(false)} />}

      <aside className={`sidebar panel ${navOpen ? 'open' : ''}`}>
        <Link to="/dashboard" className="brand-crest">
          <div className="brand-crest-mark-wrap">
            <span className="brand-crest-glyph">
              <OmegaMark size={100} />
            </span>
          </div>
          <span className="brand-crest-divider" aria-hidden="true" />
          <h1 className="brand-crest-title">Omega</h1>
        </Link>

        <nav className="nav-stack" aria-label="Main navigation">
          {navItems.map((item) =>
            item.path ? (
              <NavLink
                key={item.label}
                to={item.path}
                className={({ isActive }) =>
                  `nav-item ${isActive ? 'active' : ''} ${item.path === '/journal/nuevo' && journalLocked ? 'locked' : ''} ${item.path === '/omega-coach' && hasUnreadBriefing ? 'has-glow' : ''}`
                }
              >
                {item.label}
                {item.path === '/journal/nuevo' && journalLocked && (
                  <span className="nav-item-lock" title="Cuarentena activa esta semana" aria-hidden="true">
                    🔒
                  </span>
                )}
                {item.path === '/omega-coach' && hasUnreadBriefing && (
                  <span className="nav-notif-dot" title="Briefing pre-sesión sin leer" />
                )}
                {item.path === '/social' && pendingRequests > 0 && (
                  <span className="nav-notif-dot" title={`${pendingRequests} solicitud${pendingRequests === 1 ? '' : 'es'} pendiente${pendingRequests === 1 ? '' : 's'}`} />
                )}
                {item.path === '/buzon' && mailboxCount > 0 && (
                  <span className="nav-item-badge">{mailboxCount}</span>
                )}
              </NavLink>
            ) : (
              <button key={item.label} className="nav-item disabled" disabled type="button">
                {item.label}
                <span className="nav-soon">Próximamente</span>
              </button>
            ),
          )}
        </nav>

        <div className="mini-panel session-card">
          <div className="stat-header">
            <span>{user?.email}</span>
          </div>
          {notifPermission !== 'unsupported' && (
            <button
              type="button"
              className="ghost-btn btn-sm notif-toggle-btn"
              onClick={handleEnableNotifications}
              disabled={notifPermission === 'granted' || notifPermission === 'denied'}
              title={
                notifPermission === 'denied'
                  ? 'Bloqueadas en el navegador — habilitalas desde su configuración de sitio.'
                  : undefined
              }
            >
              🔔{' '}
              {notifPermission === 'granted'
                ? 'Notificaciones activadas'
                : notifPermission === 'denied'
                  ? 'Notificaciones bloqueadas'
                  : 'Activar notificaciones'}
            </button>
          )}
          <button className="ghost-btn" onClick={signOut}>
            Cerrar sesión
          </button>
        </div>
      </aside>

      <main className="main-panel">
        <Outlet />
      </main>
      </div>

      <OmegaChat />
      <OmegaAlertModal />
      <MedalUnlockToast />
      {showOnboarding && <OnboardingCarousel onClose={handleCloseOnboarding} />}
    </MedalProvider>
    </OmegaProvider>
  );
}

export default MainLayout;
