import { useEffect, useState, type FormEvent } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  getFriendRequestBetween,
  getFriendVirtusStage,
  getFriends,
  searchProfileByEmail,
  sendFriendRequest,
  type Friend,
  type ProfileMatch,
} from '../lib/api';
import { isOnline, lastSeenLabel } from '../lib/presence';
import { stageBadges } from '../lib/virtus';
import VirtusIcon, { type VirtusLevel } from '../components/VirtusIcon';

function stageAccent(level: string | null) {
  if (!level) return 'gold';
  return stageBadges.find((badge) => badge.level === level)?.accent ?? 'gold';
}

function Social() {
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [friends, setFriends] = useState<Friend[]>([]);
  const [friendStages, setFriendStages] = useState<Record<string, string | null>>({});

  const [searchEmail, setSearchEmail] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchResult, setSearchResult] = useState<ProfileMatch | null>(null);
  const [searchStatusMsg, setSearchStatusMsg] = useState<string | null>(null);
  const [existingStatus, setExistingStatus] = useState<'pending' | 'accepted' | 'rejected' | null>(null);
  const [sending, setSending] = useState(false);

  const loadAll = async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const friendList = await getFriends(user.id);
      setFriends(friendList);

      const stagesEntries = await Promise.all(
        friendList.map(async (friend) => [friend.userId, await getFriendVirtusStage(friend.userId)] as const),
      );
      setFriendStages(Object.fromEntries(stagesEntries));
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

  const handleSearch = async (event: FormEvent) => {
    event.preventDefault();
    if (!user || !searchEmail.trim()) return;

    setSearching(true);
    setSearchResult(null);
    setSearchStatusMsg(null);
    setExistingStatus(null);

    try {
      const match = await searchProfileByEmail(searchEmail.trim());
      if (!match) {
        setSearchStatusMsg('No se encontró ningún usuario con ese correo.');
        return;
      }
      if (match.id === user.id) {
        setSearchStatusMsg('Ese eres tú.');
        return;
      }

      const existing = await getFriendRequestBetween(user.id, match.id);
      setSearchResult(match);
      setExistingStatus(existing?.status ?? null);
    } catch (err) {
      setSearchStatusMsg(err instanceof Error ? err.message : 'Error al buscar.');
    } finally {
      setSearching(false);
    }
  };

  const handleSendRequest = async () => {
    if (!user || !searchResult) return;
    setSending(true);
    try {
      await sendFriendRequest(user.id, searchResult.id);
      setExistingStatus('pending');
    } catch (err) {
      setSearchStatusMsg(err instanceof Error ? err.message : 'No se pudo enviar la solicitud.');
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return <div className="skeleton skeleton-table" />;
  }

  return (
    <>
      <header className="topbar panel">
        <div>
          <p className="eyebrow">La Hermandad</p>
          <h2>Fraternidad</h2>
          <p className="page-description">
            Agrega amigos, compara tu progreso y comparte tu journal cuando estén operando al mismo tiempo.
          </p>
        </div>
        <form className="friend-search-form" onSubmit={handleSearch}>
          <label className="auth-field friend-search-field">
            <span className="eyebrow">Agregar amigo</span>
            <input
              type="email"
              value={searchEmail}
              onChange={(event) => setSearchEmail(event.target.value)}
              placeholder="correo@ejemplo.com"
              required
            />
          </label>
          <button type="submit" className="primary-btn" disabled={searching}>
            {searching ? 'Buscando…' : 'Buscar'}
          </button>
        </form>
      </header>

      {error && <div className="panel error-banner">No se pudieron cargar los datos: {error}</div>}

      {(searchStatusMsg || searchResult) && (
        <section className="panel plan-section">
          {searchStatusMsg && <p className="hint-text">{searchStatusMsg}</p>}

          {searchResult && (
            <div className="repeatable-card">
              <div className="repeatable-card-header">
                <span>{searchResult.label}</span>
              </div>
              {existingStatus === 'accepted' && <p className="hint-text">Ya son amigos.</p>}
              {existingStatus === 'pending' && <p className="hint-text">Solicitud pendiente.</p>}
              {existingStatus === 'rejected' && <p className="hint-text">Solicitud rechazada previamente.</p>}
              {existingStatus === null && (
                <button type="button" className="primary-btn" disabled={sending} onClick={handleSendRequest}>
                  {sending ? 'Enviando…' : 'Enviar solicitud'}
                </button>
              )}
            </div>
          )}
        </section>
      )}

      <section className="panel plan-section">
        <h3 className="friends-title">Fraternidad</h3>
        {friends.length === 0 ? (
          <p className="hint-text">Aún no tienes amigos agregados.</p>
        ) : (
          <div className="friend-list">
            {friends.map((friend) => {
              const level = friendStages[friend.userId];
              return (
                <div className="friend-row" key={friend.userId}>
                  <span className="friend-avatar">{friend.label.slice(0, 2).toUpperCase()}</span>
                  <span
                    className={`presence-dot ${isOnline(friend.lastSeenAt) ? 'online' : 'offline'}`}
                    title={lastSeenLabel(friend.lastSeenAt)}
                  />
                  <span className="friend-name">{friend.label}</span>
                  {level && (
                    <span className="friend-stage">
                      <span className="friend-stage-label">{level}</span>
                      <span className={`friend-emblem ${stageAccent(level)}`}>
                        <VirtusIcon level={level as VirtusLevel} className="friend-emblem-icon" />
                      </span>
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </>
  );
}

export default Social;
