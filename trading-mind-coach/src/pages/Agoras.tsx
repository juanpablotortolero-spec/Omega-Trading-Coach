import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import AgorasInfoModal from '../components/AgorasInfoModal';
import { useAuth } from '../contexts/AuthContext';
import {
  createAgora,
  getAgoraJoinRequestStatus,
  getMyAgoras,
  requestAgoraAccess,
  searchAgoras,
  type Agora,
  type AgoraJoinRequestStatus,
  type AgoraSearchResult,
} from '../lib/api';

function Agoras() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [agoras, setAgoras] = useState<Agora[]>([]);
  const [infoOpen, setInfoOpen] = useState(false);

  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);

  const [joinQuery, setJoinQuery] = useState('');
  const [joinSearching, setJoinSearching] = useState(false);
  const [joinResults, setJoinResults] = useState<AgoraSearchResult[]>([]);
  const [joinStatusById, setJoinStatusById] = useState<Record<string, AgoraJoinRequestStatus>>({});
  const [joinMsg, setJoinMsg] = useState<string | null>(null);
  const [requestingId, setRequestingId] = useState<string | null>(null);

  const loadAgoras = async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const list = await getMyAgoras(user.id);
      setAgoras(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar los Ágoras.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAgoras();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const handleJoinSearch = async (event: FormEvent) => {
    event.preventDefault();
    if (!user || !joinQuery.trim()) return;

    setJoinSearching(true);
    setJoinMsg(null);
    setJoinResults([]);

    try {
      const results = await searchAgoras(joinQuery.trim());
      if (results.length === 0) {
        setJoinMsg('No se encontró ningún Ágora con ese nombre.');
        return;
      }

      const statusEntries = await Promise.all(
        results.map(async (agora) => [agora.id, await getAgoraJoinRequestStatus(agora.id, user.id)] as const),
      );
      setJoinResults(results);
      setJoinStatusById((current) => {
        const next = { ...current };
        statusEntries.forEach(([agoraId, status]) => {
          if (status) next[agoraId] = status.status;
        });
        return next;
      });
    } catch (err) {
      setJoinMsg(err instanceof Error ? err.message : 'Error al buscar.');
    } finally {
      setJoinSearching(false);
    }
  };

  const handleRequestAccess = async (agoraId: string) => {
    if (!user) return;
    setRequestingId(agoraId);
    try {
      await requestAgoraAccess(agoraId, user.id);
      setJoinStatusById((current) => ({ ...current, [agoraId]: 'pending' }));
    } catch (err) {
      setJoinMsg(err instanceof Error ? err.message : 'No se pudo enviar la solicitud.');
    } finally {
      setRequestingId(null);
    }
  };

  const handleCreate = async (event: FormEvent) => {
    event.preventDefault();
    if (!user || !newName.trim()) return;
    setCreating(true);
    try {
      await createAgora(user.id, newName.trim());
      setNewName('');
      await loadAgoras();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear el Ágora.');
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return <div className="skeleton skeleton-table" />;
  }

  return (
    <>
      <header className="topbar panel">
        <button
          type="button"
          className="info-btn"
          onClick={() => setInfoOpen(true)}
          aria-label="Cómo funcionan las Ágoras"
        >
          ℹ
        </button>
        <div>
          <p className="eyebrow">Grupos Privados</p>
          <h2>Ágoras</h2>
          <p className="page-description">
            Crea círculos cerrados de traders. Comparte tu journal con todo el grupo de un solo paso para auditar el
            progreso en conjunto.
          </p>
        </div>
        <form className="friend-search-form" onSubmit={handleJoinSearch}>
          <label className="auth-field friend-search-field">
            <span className="eyebrow">Buscar Ágora</span>
            <input
              type="text"
              value={joinQuery}
              onChange={(event) => setJoinQuery(event.target.value)}
              placeholder="Nombre del Ágora"
              required
            />
          </label>
          <button type="submit" className="primary-btn" disabled={joinSearching}>
            {joinSearching ? 'Buscando…' : 'Buscar'}
          </button>
        </form>
      </header>

      {error && <div className="panel error-banner">No se pudieron cargar los datos: {error}</div>}

      {(joinMsg || joinResults.length > 0) && (
        <section className="panel plan-section">
          {joinMsg && <p className="hint-text">{joinMsg}</p>}
          {joinResults.length > 0 && (
            <div className="repeatable-list">
              {joinResults.map((agora) => {
                const status = joinStatusById[agora.id];
                return (
                  <div className="repeatable-card" key={agora.id}>
                    <div className="repeatable-card-header">
                      <span>{agora.name}</span>
                      <span className="nav-soon">
                        {agora.memberCount} miembro{agora.memberCount === 1 ? '' : 's'}
                      </span>
                    </div>
                    {status === 'accepted' && <p className="hint-text">Ya eres miembro.</p>}
                    {status === 'pending' && <p className="hint-text">Solicitud pendiente.</p>}
                    {status === 'rejected' && <p className="hint-text">Solicitud rechazada previamente.</p>}
                    {!status && (
                      <button
                        type="button"
                        className="primary-btn"
                        disabled={requestingId === agora.id}
                        onClick={() => handleRequestAccess(agora.id)}
                      >
                        {requestingId === agora.id ? 'Enviando…' : 'Solicitar acceso'}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      <section className="panel plan-section">
        <h3>Crear Ágora</h3>
        <form className="share-row" onSubmit={handleCreate}>
          <label className="auth-field" style={{ flex: 1 }}>
            <input
              type="text"
              value={newName}
              onChange={(event) => setNewName(event.target.value)}
              placeholder="Nombre del Ágora"
              maxLength={60}
              required
            />
          </label>
          <button type="submit" className="primary-btn" disabled={creating}>
            {creating ? 'Creando…' : 'Crear'}
          </button>
        </form>
      </section>

      <section className="panel plan-section">
        <h3 className="friends-title">Ágoras</h3>
        {agoras.length === 0 ? (
          <div className="empty-state">
            <span className="empty-icon" />
            <h3>Aún no perteneces a ningún Ágora</h3>
            <p>Crea el primero para empezar a auditar el progreso con tu grupo.</p>
          </div>
        ) : (
          <div className="repeatable-list">
            {agoras.map((agora) => {
              const isOwner = agora.ownerId === user?.id;
              return (
                <div className="repeatable-card" key={agora.id}>
                  <button type="button" className="agora-header-btn" onClick={() => navigate(`/agoras/${agora.id}`)}>
                    <div className="repeatable-card-header" style={{ flex: 1 }}>
                      <span>{agora.name}</span>
                      <span className="nav-soon">
                        {agora.memberCount} miembro{agora.memberCount === 1 ? '' : 's'}
                        {isOwner ? ' · Dueño' : ''}
                      </span>
                    </div>
                    <span className="agora-chevron">→</span>
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <AgorasInfoModal open={infoOpen} onClose={() => setInfoOpen(false)} />
    </>
  );
}

export default Agoras;
