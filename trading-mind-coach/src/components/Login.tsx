import { useState, type CSSProperties, type FormEvent } from 'react';
import { useAuth } from '../contexts/AuthContext';
import OmegaMark from './OmegaMark';

/**
 * Computed once at module load (not per render) so the drifting grains don't
 * reset position on every keystroke while the user types their credentials.
 */
const sandParticles = Array.from({ length: 50 }, () => ({
  left: Math.random() * 100,
  delay: Math.random() * 16,
  duration: 16 + Math.random() * 12,
  size: 2 + Math.random() * 6,
  drift: 40 + Math.random() * 140,
  opacity: 0.18 + Math.random() * 0.4,
}));

const REMEMBER_FLAG = 'pat_remember_me';
const REMEMBER_CONFIRMED = 'pat_remember_confirmed';

function Login() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [showRememberConfirm, setShowRememberConfirm] = useState(false);

  const handleRememberToggle = (checked: boolean) => {
    if (checked && localStorage.getItem(REMEMBER_CONFIRMED) !== 'true') {
      setShowRememberConfirm(true);
      return;
    }
    setRememberMe(checked);
  };

  const confirmRemember = () => {
    localStorage.setItem(REMEMBER_CONFIRMED, 'true');
    setRememberMe(true);
    setShowRememberConfirm(false);
  };

  const cancelRemember = () => {
    setShowRememberConfirm(false);
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setInfo(null);
    setSubmitting(true);
    localStorage.setItem(REMEMBER_FLAG, rememberMe ? 'true' : 'false');

    const { error: authError } =
      mode === 'signin' ? await signIn(email, password) : await signUp(email, password);

    setSubmitting(false);

    if (authError) {
      setError(authError);
      return;
    }

    if (mode === 'signup') {
      setInfo('Cuenta creada. Revisa tu correo para confirmar el acceso.');
    }
  };

  return (
    <div className="auth-shell">
      <div className="sand-drift" aria-hidden="true">
        {sandParticles.map((particle, index) => (
          <span
            key={index}
            className="sand-grain"
            style={
              {
                left: `${particle.left}%`,
                width: `${particle.size}px`,
                height: `${particle.size}px`,
                opacity: particle.opacity,
                animationDelay: `${particle.delay}s`,
                animationDuration: `${particle.duration}s`,
                '--drift-x': `${particle.drift}px`,
              } as CSSProperties
            }
          />
        ))}
      </div>

      <div className="panel auth-card">
        <div className="brand-block">
          <div className="brand-mark">
            <OmegaMark size={84} />
          </div>
          <div>
            <h1>Omega</h1>
          </div>
        </div>

        <div className="auth-tabs">
          <button
            type="button"
            className={`auth-tab ${mode === 'signin' ? 'active' : ''}`}
            onClick={() => setMode('signin')}
          >
            Ingresar
          </button>
          <button
            type="button"
            className={`auth-tab ${mode === 'signup' ? 'active' : ''}`}
            onClick={() => setMode('signup')}
          >
            Crear cuenta
          </button>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          <label className="auth-field">
            <span className="eyebrow">Correo</span>
            <input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="nombre@dominio.com"
            />
          </label>

          <label className="auth-field">
            <span className="eyebrow">Contraseña</span>
            <input
              type="password"
              autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
              required
              minLength={6}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="••••••••"
            />
          </label>

          <label className="checkbox-field remember-field">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(event) => handleRememberToggle(event.target.checked)}
            />
            Recuérdame en este dispositivo
          </label>

          {showRememberConfirm && (
            <div className="remember-confirm">
              <p>
                ¿Quieres mantener tu sesión iniciada en este dispositivo hasta que cierres sesión
                manualmente?
              </p>
              <div className="remember-confirm-actions">
                <button type="button" className="ghost-btn btn-sm" onClick={cancelRemember}>
                  Cancelar
                </button>
                <button type="button" className="primary-btn btn-sm" onClick={confirmRemember}>
                  Sí, recordarme
                </button>
              </div>
            </div>
          )}

          {error && <p className="auth-message error">{error}</p>}
          {info && <p className="auth-message info">{info}</p>}

          <button type="submit" className="primary-btn auth-submit" disabled={submitting}>
            {submitting ? 'Procesando…' : mode === 'signin' ? 'Ingresar' : 'Crear cuenta'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default Login;
