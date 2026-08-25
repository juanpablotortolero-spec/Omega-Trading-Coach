import { useEffect, useState, type FormEvent } from 'react';
import { connectTradovateAccount, type TradovateConnectInput } from '../lib/tradovateApi';

function TradovateConnectModal({
  open,
  onClose,
  onConnected,
}: {
  open: boolean;
  onClose: () => void;
  onConnected: () => void;
}) {
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [cid, setCid] = useState('');
  const [sec, setSec] = useState('');
  const [env, setEnv] = useState<TradovateConnectInput['env']>('demo');
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setConnecting(true);
    setError(null);
    try {
      const result = await connectTradovateAccount({ name, password, cid, sec, env });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setPassword('');
      setSec('');
      onConnected();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo conectar la cuenta.');
    } finally {
      setConnecting(false);
    }
  };

  return (
    <div className="info-modal-backdrop" onClick={onClose}>
      <div className="info-modal-panel" onClick={(event) => event.stopPropagation()}>
        <div className="info-modal-header">
          <h2>Conectar Tradovate</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Cerrar">
            ✕
          </button>
        </div>

        <section className="info-modal-section">
          <p className="hint-text">
            Tus credenciales se guardan del lado del servidor (Supabase Edge Function) y nunca llegan al
            navegador de nuevo — no se procesan ni se ven en esta app fuera de esta conexión inicial.
          </p>

          <form onSubmit={handleSubmit} className="tradovate-connect-form">
            <div className="pill-row">
              {(['demo', 'live'] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  className={`pill-btn gold small ${env === option ? 'active' : ''}`}
                  onClick={() => setEnv(option)}
                >
                  {option === 'demo' ? 'Cuenta demo' : 'Cuenta real'}
                </button>
              ))}
            </div>

            <label className="auth-field">
              <span className="eyebrow">Usuario Tradovate</span>
              <input type="text" value={name} onChange={(event) => setName(event.target.value)} required />
            </label>

            <label className="auth-field">
              <span className="eyebrow">Contraseña</span>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
            </label>

            <div className="field-grid-2">
              <label className="auth-field">
                <span className="eyebrow">CID</span>
                <input type="text" value={cid} onChange={(event) => setCid(event.target.value)} required />
              </label>
              <label className="auth-field">
                <span className="eyebrow">Secret</span>
                <input type="password" value={sec} onChange={(event) => setSec(event.target.value)} required />
              </label>
            </div>

            <p className="hint-text">
              CID y Secret se generan desde la pestaña "API Access" de tu cuenta Tradovate (requiere cuenta real
              con al menos $1,000 y la suscripción de API activa).
            </p>

            {error && <p className="hint-text">{error}</p>}

            <button type="submit" className="primary-btn" disabled={connecting}>
              {connecting ? 'Conectando…' : 'Conectar cuenta'}
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}

export default TradovateConnectModal;
