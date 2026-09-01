import { useEffect, useState } from 'react';
import VirtusIcon, { type VirtusLevel } from '../components/VirtusIcon';
import VirtusProgressBar from '../components/VirtusProgressBar';
import { useAuth } from '../contexts/AuthContext';
import { useRefresh } from '../contexts/RefreshContext';
import {
  getMyProfile,
  getTodaySessionVirtusDelta,
  getVirtusPeak,
  getVirtusTotal,
  updateDisplayName,
} from '../lib/api';
import { localIsoDate } from '../lib/calendar';
import { currentStage } from '../lib/virtus';
import UserEmblem from '../components/UserEmblem';
import VirtusRankMapModal from '../components/VirtusRankMapModal';

function todayIso() {
  return localIsoDate(new Date());
}

function Perfil() {
  const { user, signOut } = useAuth();
  const { bump } = useRefresh();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [virtusTotal, setVirtusTotal] = useState(0);
  const [todayDelta, setTodayDelta] = useState(0);
  const [peakTotal, setPeakTotal] = useState(0);

  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [savingName, setSavingName] = useState(false);
  const [rankMapOpen, setRankMapOpen] = useState(false);

  const loadAll = async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const [profile, total, delta] = await Promise.all([
        getMyProfile(user.id),
        getVirtusTotal(user.id),
        getTodaySessionVirtusDelta(user.id, todayIso()),
      ]);
      const peak = await getVirtusPeak(user.id, total);
      setDisplayName(profile.displayName);
      setNameInput(profile.displayName ?? '');
      setVirtusTotal(total);
      setTodayDelta(delta);
      setPeakTotal(peak);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar tu perfil.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const handleSaveName = async () => {
    if (!user) return;
    setSavingName(true);
    try {
      await updateDisplayName(user.id, nameInput);
      setDisplayName(nameInput.trim() || null);
      setEditingName(false);
      bump();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar el nombre.');
    } finally {
      setSavingName(false);
    }
  };

  if (loading) {
    return <div className="skeleton skeleton-table" />;
  }

  const resolvedName = displayName || user?.email?.split('@')[0] || '';
  const stage = currentStage(virtusTotal);

  return (
    <>
      <header className="topbar panel">
        <div>
          <p className="eyebrow">Identidad</p>
          <h2>Perfil</h2>
          <p className="page-description">Tu información, tu progreso y tus ajustes de cuenta.</p>
        </div>
      </header>

      {error && <div className="panel error-banner">No se pudieron cargar los datos: {error}</div>}

      <section className="content-grid">
        <article className="panel plan-section">
          <h3>Identidad</h3>
          <div className="profile-avatar" style={{ margin: '0 auto 4px' }}>
            <UserEmblem letter={resolvedName.slice(0, 1).toUpperCase()} size={64} />
          </div>

          {editingName ? (
            <div className="share-row">
              <label className="auth-field" style={{ flex: 1 }}>
                <input
                  type="text"
                  value={nameInput}
                  onChange={(event) => setNameInput(event.target.value)}
                  placeholder="Tu nombre visible"
                  maxLength={40}
                />
              </label>
              <button type="button" className="primary-btn" disabled={savingName} onClick={handleSaveName}>
                {savingName ? 'Guardando…' : 'Guardar'}
              </button>
              <button
                type="button"
                className="ghost-btn"
                onClick={() => {
                  setEditingName(false);
                  setNameInput(displayName ?? '');
                }}
              >
                Cancelar
              </button>
            </div>
          ) : (
            <div className="repeatable-card-header">
              <span>{resolvedName}</span>
              <button type="button" className="ghost-btn" onClick={() => setEditingName(true)}>
                Editar
              </button>
            </div>
          )}
          <p className="hint-text">Así te verán tus amigos en Fraternidad y Ágoras.</p>

          <div className="repeatable-card-header">
            <span className="eyebrow">Correo</span>
            <span>{user?.email}</span>
          </div>

          <button className="ghost-btn" onClick={signOut}>
            Cerrar sesión
          </button>
        </article>

        <article className="panel plan-section">
          <h3>Tu Progreso</h3>
          <button
            type="button"
            className={`badge-mark ${stage.accent}`}
            style={{ margin: '0 auto' }}
            onClick={() => setRankMapOpen(true)}
            aria-label="Ver el Mapa de Rangos Virtus"
          >
            <VirtusIcon level={stage.level as VirtusLevel} className="badge-mark-icon" />
          </button>
          <p className="hint-text" style={{ textAlign: 'center' }}>
            {stage.level} · {stage.name}
          </p>
          <VirtusProgressBar virtusTotal={virtusTotal} todayDelta={todayDelta} peakTotal={peakTotal} />
        </article>
      </section>

      <VirtusRankMapModal open={rankMapOpen} onClose={() => setRankMapOpen(false)} virtusTotal={virtusTotal} />
    </>
  );
}

export default Perfil;
