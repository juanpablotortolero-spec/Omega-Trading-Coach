import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  getPendingAgoraRequests,
  getPendingFriendRequests,
  getRecentEntrySealStatus,
  getRecentSharesForMe,
  respondToAgoraRequest,
  respondToFriendRequest,
  type PendingAgoraRequest,
  type PendingFriendRequest,
  type SharedEntry,
} from '../lib/api';
import { localIsoDate } from '../lib/calendar';

function Buzon() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [pending, setPending] = useState<PendingFriendRequest[]>([]);
  const [agoraRequests, setAgoraRequests] = useState<PendingAgoraRequest[]>([]);
  const [shares, setShares] = useState<SharedEntry[]>([]);
  const [unsealedDate, setUnsealedDate] = useState<string | null>(null);

  const [filterUserId, setFilterUserId] = useState<string | null>(null);
  const [filterDate, setFilterDate] = useState('');

  const loadAll = async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const [pendingList, agoraRequestList, shareList, sealStatus] = await Promise.all([
        getPendingFriendRequests(user.id),
        getPendingAgoraRequests(user.id),
        getRecentSharesForMe(user.id, 100),
        getRecentEntrySealStatus(user.id, localIsoDate(new Date())),
      ]);
      setPending(pendingList);
      setAgoraRequests(agoraRequestList);
      setShares(shareList);
      setUnsealedDate(sealStatus && !sealStatus.sealed ? sealStatus.entryDate : null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar los datos.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const handleRespond = async (requestId: string, accept: boolean) => {
    await respondToFriendRequest(requestId, accept);
    await loadAll();
  };

  const handleRespondAgora = async (requestId: string, accept: boolean) => {
    await respondToAgoraRequest(requestId, accept);
    await loadAll();
  };

  const shareSenders = useMemo(() => {
    const map = new Map<string, string>();
    shares.forEach((share) => map.set(share.fromUserId, share.fromLabel));
    return Array.from(map.entries()).map(([userId, label]) => ({ userId, label }));
  }, [shares]);

  const filteredShares = shares.filter((share) => {
    if (filterUserId && share.fromUserId !== filterUserId) return false;
    if (filterDate && share.entryDate !== filterDate) return false;
    return true;
  });

  if (loading) {
    return <div className="skeleton skeleton-table" />;
  }

  return (
    <>
      <header className="topbar panel">
        <div>
          <p className="eyebrow">Correspondencia</p>
          <h2>Buzón</h2>
          <p className="page-description">
            Solicitudes de amistad y journals que tus amigos compartieron contigo.
          </p>
        </div>
      </header>

      {error && <div className="panel error-banner">No se pudieron cargar los datos: {error}</div>}

      {unsealedDate && (
        <section className="panel plan-section">
          <h3>Journal sin sellar</h3>
          <div className="repeatable-card">
            <div className="repeatable-card-header">
              <span>Tienes un journal sin sellar del {unsealedDate}</span>
            </div>
            <p className="hint-text">
              No podrás abrir un journal de un día distinto hasta que lo selles.
            </p>
            <button
              type="button"
              className="pill-btn gold small active"
              onClick={() => navigate(`/journal/nuevo?date=${unsealedDate}`)}
            >
              Ir a sellarlo →
            </button>
          </div>
        </section>
      )}

      <section className="panel plan-section">
        <h3>Solicitudes</h3>
        {pending.length === 0 ? (
          <div className="empty-state">
            <span className="empty-icon" />
            <h3>Sin solicitudes por ahora</h3>
            <p>Cuando alguien te agregue, aparecerá aquí.</p>
          </div>
        ) : (
          <div className="repeatable-list">
            {pending.map((request) => (
              <div className="repeatable-card" key={request.id}>
                <div className="repeatable-card-header">
                  <span>{request.label} quiere ser tu amigo</span>
                </div>
                <div className="pill-row">
                  <button
                    type="button"
                    className="pill-btn long small active"
                    onClick={() => handleRespond(request.id, true)}
                  >
                    Aceptar
                  </button>
                  <button
                    type="button"
                    className="pill-btn short small active"
                    onClick={() => handleRespond(request.id, false)}
                  >
                    Rechazar
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="panel plan-section">
        <h3>Solicitudes de Ágora</h3>
        {agoraRequests.length === 0 ? (
          <div className="empty-state">
            <span className="empty-icon" />
            <h3>Sin solicitudes por ahora</h3>
            <p>Cuando alguien pida unirse a un Ágora tuyo, aparecerá aquí.</p>
          </div>
        ) : (
          <div className="repeatable-list">
            {agoraRequests.map((request) => (
              <div className="repeatable-card" key={request.id}>
                <div className="repeatable-card-header">
                  <span>
                    {request.label} quiere unirse a {request.agoraName}
                  </span>
                </div>
                <div className="pill-row">
                  <button
                    type="button"
                    className="pill-btn long small active"
                    onClick={() => handleRespondAgora(request.id, true)}
                  >
                    Aceptar
                  </button>
                  <button
                    type="button"
                    className="pill-btn short small active"
                    onClick={() => handleRespondAgora(request.id, false)}
                  >
                    Rechazar
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="panel plan-section">
        <h3>Compartido contigo</h3>

        {shares.length > 0 && (
          <>
            <div className="pill-row">
              <button
                type="button"
                className={`pill-btn gold small ${filterUserId === null ? 'active' : ''}`}
                onClick={() => setFilterUserId(null)}
              >
                Todos
              </button>
              {shareSenders.map((sender) => (
                <button
                  key={sender.userId}
                  type="button"
                  className={`pill-btn gold small ${filterUserId === sender.userId ? 'active' : ''}`}
                  onClick={() => setFilterUserId(sender.userId)}
                >
                  {sender.label}
                </button>
              ))}
            </div>
            <div className="share-row" style={{ alignItems: 'center' }}>
              <label className="auth-field" style={{ maxWidth: 220 }}>
                <span className="eyebrow">Filtrar por fecha</span>
                <input type="date" value={filterDate} onChange={(event) => setFilterDate(event.target.value)} />
              </label>
              {filterDate && (
                <button type="button" className="ghost-btn" onClick={() => setFilterDate('')}>
                  Limpiar fecha
                </button>
              )}
            </div>
          </>
        )}

        {filteredShares.length === 0 ? (
          <p className="hint-text">
            {shares.length === 0 ? 'Nadie ha compartido un journal contigo todavía.' : 'Nada coincide con ese filtro.'}
          </p>
        ) : (
          <div className="share-preview-list" style={{ borderTop: 'none', paddingTop: 0 }}>
            {filteredShares.map((share) => (
              <button
                key={share.id}
                type="button"
                className="shared-entry-row"
                onClick={() => navigate(`/social/entrada/${share.journalEntryId}`)}
              >
                <span>
                  {share.fromLabel} compartió su journal del {share.entryDate}
                </span>
                <span>→</span>
              </button>
            ))}
          </div>
        )}
      </section>
    </>
  );
}

export default Buzon;
