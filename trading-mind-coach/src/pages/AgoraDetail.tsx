import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { autoGrow } from '../lib/autoGrow';
import { stageBadges } from '../lib/virtus';
import UserEmblem from '../components/UserEmblem';
import VirtusIcon, { type VirtusLevel } from '../components/VirtusIcon';
import {
  addAgoraMember,
  deleteAgora,
  getAgoraById,
  getAgoraFiles,
  getAgoraMemberVirtusStage,
  getAgoraMembers,
  getAgoraMessages,
  getAgoraSharedEntries,
  removeAgoraFile,
  removeAgoraMember,
  searchProfileByEmail,
  sendAgoraMessage,
  setAgoraMemberRole,
  uploadAgoraFile,
  type Agora,
  type AgoraFile,
  type AgoraMember,
  type AgoraMessage,
  type AgoraSharedEntry,
  type ProfileMatch,
} from '../lib/api';

const MESSAGE_POLL_MS = 15000;
const MESSAGE_RUN_GAP_MS = 5 * 60 * 1000;

type TabKey = 'miembros' | 'mensajes' | 'journals' | 'archivos';

const tabs: { key: TabKey; label: string }[] = [
  { key: 'miembros', label: 'Miembros' },
  { key: 'mensajes', label: 'Mensajes' },
  { key: 'journals', label: 'Journals' },
  { key: 'archivos', label: 'Archivos' },
];

function stageAccent(level: string | null) {
  if (!level) return 'gold';
  return stageBadges.find((badge) => badge.level === level)?.accent ?? 'gold';
}

function userColorClass(userId: string) {
  let hash = 0;
  for (let i = 0; i < userId.length; i += 1) {
    hash = (hash * 31 + userId.charCodeAt(i)) | 0;
  }
  return `agora-user-color-${Math.abs(hash) % 5}`;
}

function formatDayLabel(value: string) {
  return new Date(value).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
}

function formatTime(value: string) {
  return new Date(value).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: 'short' });
}

function formatEntryDate(value: string) {
  if (!value) return '—';
  return new Date(`${value}T00:00:00`).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
}

function formatSize(bytes: number | null) {
  if (bytes === null) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fileExtension(fileName: string) {
  const parts = fileName.split('.');
  return parts.length > 1 ? parts[parts.length - 1].toUpperCase() : '—';
}

type MessageRun = { authorId: string; authorLabel: string; items: AgoraMessage[] };
type MessageDayGroup = { dayKey: string; dateLabel: string; runs: MessageRun[] };

function groupMessages(messages: AgoraMessage[]): MessageDayGroup[] {
  const groups: MessageDayGroup[] = [];

  messages.forEach((message) => {
    const dayKey = message.createdAt.slice(0, 10);
    let group = groups[groups.length - 1];
    if (!group || group.dayKey !== dayKey) {
      group = { dayKey, dateLabel: formatDayLabel(message.createdAt), runs: [] };
      groups.push(group);
    }

    const lastRun = group.runs[group.runs.length - 1];
    const lastItem = lastRun?.items[lastRun.items.length - 1];
    const gap = lastItem ? new Date(message.createdAt).getTime() - new Date(lastItem.createdAt).getTime() : Infinity;

    if (lastRun && lastRun.authorId === message.authorId && gap < MESSAGE_RUN_GAP_MS) {
      lastRun.items.push(message);
    } else {
      group.runs.push({ authorId: message.authorId, authorLabel: message.authorLabel, items: [message] });
    }
  });

  return groups;
}

function RankBadge({ level, size = 'default' }: { level: string | null; size?: 'default' | 'large' | 'small' }) {
  if (!level) return null;
  return (
    <span className="friend-stage">
      <span className={`friend-stage-label ${size === 'large' ? 'large' : size === 'small' ? 'small' : ''}`}>
        {level}
      </span>
      <span className={`friend-emblem ${stageAccent(level)} ${size === 'large' ? 'large' : size === 'small' ? 'small' : ''}`}>
        <VirtusIcon level={level as VirtusLevel} className="friend-emblem-icon" />
      </span>
    </span>
  );
}

function AgoraDetail() {
  const { agoraId } = useParams<{ agoraId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [agora, setAgora] = useState<Agora | null>(null);
  const [tab, setTab] = useState<TabKey>('miembros');

  const [members, setMembers] = useState<AgoraMember[]>([]);
  const [memberStages, setMemberStages] = useState<Record<string, string | null>>({});
  const [memberEmail, setMemberEmail] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchResult, setSearchResult] = useState<ProfileMatch | null>(null);
  const [searchMsg, setSearchMsg] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [roleChangingId, setRoleChangingId] = useState<string | null>(null);

  const [messages, setMessages] = useState<AgoraMessage[]>([]);
  const [messageText, setMessageText] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const [messagesError, setMessagesError] = useState<string | null>(null);

  const [sharedEntries, setSharedEntries] = useState<AgoraSharedEntry[]>([]);
  const [journalsError, setJournalsError] = useState<string | null>(null);
  const [journalFilterUserId, setJournalFilterUserId] = useState<string | null>(null);
  const [journalFilterDate, setJournalFilterDate] = useState('');

  const [files, setFiles] = useState<AgoraFile[]>([]);
  const [fileQuery, setFileQuery] = useState('');
  const [fileTitle, setFileTitle] = useState('');
  const [uploading, setUploading] = useState(false);
  const [fileMsg, setFileMsg] = useState<string | null>(null);
  const [filesError, setFilesError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isOwner = agora !== null && user !== null && agora.ownerId === user.id;
  const isMember = members.some((member) => member.userId === user?.id);
  const isAdminUser = members.some((member) => member.userId === user?.id && member.isAdmin);
  const canManageMembers = isOwner || isAdminUser;

  const load = async () => {
    if (!user || !agoraId) return;
    setLoading(true);
    setError(null);
    try {
      const [agoraData, memberList] = await Promise.all([getAgoraById(agoraId), getAgoraMembers(agoraId)]);
      setAgora(agoraData);
      setMembers(memberList);

      const stageEntries = await Promise.all(
        memberList.map(async (member) => [member.userId, await getAgoraMemberVirtusStage(member.userId)] as const),
      );
      setMemberStages(Object.fromEntries(stageEntries));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar la Ágora.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, agoraId]);

  useEffect(() => {
    if (!agoraId || tab !== 'mensajes') return;
    let cancelled = false;

    const loadMessages = async () => {
      try {
        const list = await getAgoraMessages(agoraId);
        if (!cancelled) {
          setMessages(list);
          setMessagesError(null);
        }
      } catch (err) {
        if (!cancelled) setMessagesError(err instanceof Error ? err.message : 'No se pudieron cargar los mensajes.');
      }
    };

    loadMessages();
    const interval = setInterval(loadMessages, MESSAGE_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [agoraId, tab]);

  useEffect(() => {
    if (!agoraId || tab !== 'journals') return;
    let cancelled = false;
    getAgoraSharedEntries(agoraId)
      .then((list) => {
        if (!cancelled) setSharedEntries(list);
      })
      .catch((err) => {
        if (!cancelled) setJournalsError(err instanceof Error ? err.message : 'No se pudieron cargar los journals.');
      });
    return () => {
      cancelled = true;
    };
  }, [agoraId, tab]);

  const loadFiles = async () => {
    if (!agoraId) return;
    try {
      const list = await getAgoraFiles(agoraId);
      setFiles(list);
      setFilesError(null);
    } catch (err) {
      setFilesError(err instanceof Error ? err.message : 'No se pudieron cargar los archivos.');
    }
  };

  useEffect(() => {
    if (tab !== 'archivos') return;
    loadFiles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agoraId, tab]);

  const refreshMembers = async () => {
    if (!agoraId) return;
    const list = await getAgoraMembers(agoraId);
    setMembers(list);
    setAgora((current) => (current ? { ...current, memberCount: list.length } : current));
  };

  const handleSearchMember = async (event: FormEvent) => {
    event.preventDefault();
    if (!memberEmail.trim()) return;
    setSearching(true);
    setSearchResult(null);
    setSearchMsg(null);
    try {
      const match = await searchProfileByEmail(memberEmail.trim());
      if (!match) {
        setSearchMsg('No se encontró ningún usuario con ese correo.');
        return;
      }
      if (members.some((member) => member.userId === match.id)) {
        setSearchMsg('Ya es miembro de este Ágora.');
        return;
      }
      setSearchResult(match);
    } catch (err) {
      setSearchMsg(err instanceof Error ? err.message : 'Error al buscar.');
    } finally {
      setSearching(false);
    }
  };

  const handleAddMember = async () => {
    if (!agoraId || !searchResult) return;
    setAdding(true);
    try {
      await addAgoraMember(agoraId, searchResult.id);
      await refreshMembers();
      setSearchResult(null);
      setMemberEmail('');
      setSearchMsg('Miembro agregado.');
    } catch (err) {
      setSearchMsg(err instanceof Error ? err.message : 'No se pudo agregar.');
    } finally {
      setAdding(false);
    }
  };

  const handleRemoveMember = async (userId: string) => {
    if (!agoraId) return;
    try {
      await removeAgoraMember(agoraId, userId);
      await refreshMembers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo quitar al miembro.');
    }
  };

  const handleToggleAdmin = async (member: AgoraMember) => {
    if (!agoraId) return;
    setRoleChangingId(member.userId);
    try {
      await setAgoraMemberRole(agoraId, member.userId, member.isAdmin ? 'member' : 'admin');
      await refreshMembers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cambiar el rol.');
    } finally {
      setRoleChangingId(null);
    }
  };

  const handleLeave = async () => {
    if (!agoraId || !user) return;
    try {
      await removeAgoraMember(agoraId, user.id);
      navigate('/agoras');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo salir del Ágora.');
    }
  };

  const handleDelete = async () => {
    if (!agoraId) return;
    try {
      await deleteAgora(agoraId);
      navigate('/agoras');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo eliminar el Ágora.');
    }
  };

  const handleSendMessage = async (event: FormEvent) => {
    event.preventDefault();
    if (!agoraId || !user || !messageText.trim()) return;
    setSendingMessage(true);
    try {
      await sendAgoraMessage(agoraId, user.id, messageText.trim());
      setMessageText('');
      const list = await getAgoraMessages(agoraId);
      setMessages(list);
      setMessagesError(null);
    } catch (err) {
      setMessagesError(err instanceof Error ? err.message : 'No se pudo enviar el mensaje.');
    } finally {
      setSendingMessage(false);
    }
  };

  const handleUploadFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !agoraId || !user) return;
    setUploading(true);
    setFileMsg(null);
    try {
      await uploadAgoraFile(agoraId, user.id, file, fileTitle);
      setFileTitle('');
      await loadFiles();
    } catch (err) {
      setFileMsg(err instanceof Error ? err.message : 'No se pudo subir el archivo.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRemoveFile = async (file: AgoraFile) => {
    try {
      await removeAgoraFile(file.id, file.storagePath);
      await loadFiles();
    } catch (err) {
      setFileMsg(err instanceof Error ? err.message : 'No se pudo eliminar el archivo.');
    }
  };

  const messageGroups = useMemo(() => groupMessages(messages), [messages]);

  const filteredFiles = useMemo(() => {
    const query = fileQuery.trim().toLowerCase();
    if (!query) return files;
    return files.filter((file) => file.uploaderLabel.toLowerCase().includes(query));
  }, [files, fileQuery]);

  const journalSenders = useMemo(() => {
    const map = new Map<string, string>();
    sharedEntries.forEach((share) => map.set(share.fromUserId, share.fromLabel));
    return Array.from(map.entries()).map(([userId, label]) => ({ userId, label }));
  }, [sharedEntries]);

  const filteredEntries = sharedEntries.filter((share) => {
    if (journalFilterUserId && share.fromUserId !== journalFilterUserId) return false;
    if (journalFilterDate && share.entryDate !== journalFilterDate) return false;
    return true;
  });

  if (loading) {
    return <div className="skeleton skeleton-table" />;
  }

  if (error || !agora || !isMember) {
    return (
      <section className="panel plan-section">
        <Link to="/agoras" className="back-link">
          ← Volver a Ágoras
        </Link>
        <div className="empty-state">
          <span className="empty-icon" />
          <h3>{error ?? 'No tienes acceso a esta Ágora'}</h3>
        </div>
      </section>
    );
  }

  return (
    <div className="agora-ambient">
      <header className="topbar panel">
        <div>
          <Link to="/agoras" className="back-link">
            ← Volver a Ágoras
          </Link>
          <h2 style={{ marginTop: 10 }}>{agora.name}</h2>
          <p className="page-description">
            {agora.memberCount} miembro{agora.memberCount === 1 ? '' : 's'}
            {isOwner ? ' · Dueño' : isAdminUser ? ' · Administrador' : ''}
          </p>
        </div>
      </header>

      <div className="agora-shell">
        <aside className="agora-side-nav panel">
          {tabs.map((t) => (
            <button
              key={t.key}
              type="button"
              className={`agora-side-item ${tab === t.key ? 'active' : ''}`}
              onClick={() => setTab(t.key)}
            >
              {t.label}
            </button>
          ))}
        </aside>

        <div className="agora-main">
          {tab === 'miembros' && (
            <section className="panel plan-section">
              <div className="friend-list agora-member-list">
                {members.map((member) => {
                  const level = memberStages[member.userId];
                  return (
                    <div className="friend-row agora-member-row" key={member.userId}>
                      <UserEmblem letter={member.label.slice(0, 1).toUpperCase()} size={36} />
                      <span className="friend-name">{member.label}</span>
                      <RankBadge level={level} size="large" />
                      <span className="agora-row-spacer" />
                      {member.isOwner && <span className="nav-soon">Dueño</span>}
                      {!member.isOwner && member.isAdmin && <span className="nav-soon">Admin</span>}
                      {isOwner && !member.isOwner && (
                        <button
                          type="button"
                          className="ghost-btn"
                          disabled={roleChangingId === member.userId}
                          onClick={() => handleToggleAdmin(member)}
                        >
                          {member.isAdmin ? 'Quitar admin' : 'Hacer admin'}
                        </button>
                      )}
                      {canManageMembers && !member.isOwner && !(isAdminUser && !isOwner && member.isAdmin) && (
                        <button type="button" className="ghost-btn" onClick={() => handleRemoveMember(member.userId)}>
                          Quitar
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>

              {canManageMembers && (
                <>
                  <form className="share-row" onSubmit={handleSearchMember} style={{ marginTop: 14 }}>
                    <label className="auth-field" style={{ flex: 1 }}>
                      <input
                        type="email"
                        value={memberEmail}
                        onChange={(event) => setMemberEmail(event.target.value)}
                        placeholder="correo@ejemplo.com"
                      />
                    </label>
                    <button type="submit" className="ghost-btn" disabled={searching}>
                      {searching ? 'Buscando…' : 'Buscar'}
                    </button>
                  </form>
                  {searchMsg && <p className="hint-text">{searchMsg}</p>}
                  {searchResult && (
                    <div className="repeatable-card-header">
                      <span>{searchResult.label}</span>
                      <button
                        type="button"
                        className="primary-btn btn-sm"
                        disabled={adding}
                        onClick={handleAddMember}
                      >
                        {adding ? 'Agregando…' : '+ Agregar'}
                      </button>
                    </div>
                  )}
                </>
              )}

              <div className="pill-row" style={{ marginTop: 14 }}>
                {isOwner ? (
                  <button type="button" className="pill-btn short small active" onClick={handleDelete}>
                    Eliminar Ágora
                  </button>
                ) : (
                  <button type="button" className="pill-btn short small active" onClick={handleLeave}>
                    Salir del Ágora
                  </button>
                )}
              </div>
            </section>
          )}

          {tab === 'mensajes' && (
            <section className="panel plan-section agora-chat-panel">
              {messagesError && <p className="hint-text">{messagesError}</p>}
              {messageGroups.length === 0 ? (
                <p className="hint-text">Aún no hay mensajes en esta Ágora.</p>
              ) : (
                <div className="agora-chat-log">
                  {messageGroups.map((group) => (
                    <div key={group.dayKey}>
                      <div className="agora-date-divider">
                        <span>{group.dateLabel}</span>
                      </div>
                      {group.runs.map((run, runIndex) => {
                        const level = memberStages[run.authorId];
                        return (
                          <div className="agora-msg-group" key={`${group.dayKey}-${runIndex}`}>
                            <span className="friend-avatar agora-msg-avatar">
                              {run.authorLabel.slice(0, 2).toUpperCase()}
                            </span>
                            <div className="agora-msg-body">
                              <div className="agora-msg-header">
                                <span className={`agora-msg-author ${userColorClass(run.authorId)}`}>
                                  {run.authorLabel}
                                </span>
                                {level && (
                                  <span className={`friend-emblem chat ${stageAccent(level)}`}>
                                    <VirtusIcon level={level as VirtusLevel} className="friend-emblem-icon" />
                                  </span>
                                )}
                                <span className="hint-text">{formatTime(run.items[0].createdAt)}</span>
                              </div>
                              {run.items.map((item) => (
                                <p className="agora-msg-line" key={item.id}>
                                  {item.message}
                                </p>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              )}

              <form className="share-row" onSubmit={handleSendMessage} style={{ marginTop: 16 }}>
                <label className="auth-field" style={{ flex: 1 }}>
                  <textarea
                    onInput={autoGrow}
                    value={messageText}
                    onChange={(event) => setMessageText(event.target.value)}
                    placeholder="Escribe un mensaje para el grupo…"
                    rows={2}
                  />
                </label>
                <button type="submit" className="primary-btn" disabled={sendingMessage || !messageText.trim()}>
                  {sendingMessage ? 'Enviando…' : 'Enviar'}
                </button>
              </form>
            </section>
          )}

          {tab === 'journals' && (
            <section className="panel plan-section">
              {journalSenders.length > 0 && (
                <div className="pill-row">
                  <button
                    type="button"
                    className={`pill-btn gold small ${journalFilterUserId === null ? 'active' : ''}`}
                    onClick={() => setJournalFilterUserId(null)}
                  >
                    Todos
                  </button>
                  {journalSenders.map((sender) => (
                    <button
                      key={sender.userId}
                      type="button"
                      className={`pill-btn gold small ${journalFilterUserId === sender.userId ? 'active' : ''}`}
                      onClick={() => setJournalFilterUserId(sender.userId)}
                    >
                      {sender.label}
                    </button>
                  ))}
                </div>
              )}
              <div className="share-row" style={{ alignItems: 'center', marginTop: 12 }}>
                <label className="auth-field" style={{ maxWidth: 220 }}>
                  <span className="eyebrow">Filtrar por fecha</span>
                  <input
                    type="date"
                    value={journalFilterDate}
                    onChange={(event) => setJournalFilterDate(event.target.value)}
                  />
                </label>
                {journalFilterDate && (
                  <button type="button" className="ghost-btn" onClick={() => setJournalFilterDate('')}>
                    Limpiar fecha
                  </button>
                )}
              </div>

              {journalsError && <p className="hint-text">{journalsError}</p>}
              {filteredEntries.length === 0 ? (
                <p className="hint-text" style={{ marginTop: 14 }}>
                  {sharedEntries.length === 0
                    ? 'Nadie ha compartido un journal en esta Ágora todavía.'
                    : 'Nada coincide con ese filtro.'}
                </p>
              ) : (
                <div className="repeatable-list" style={{ marginTop: 14 }}>
                  {filteredEntries.map((share) => {
                    const level = memberStages[share.fromUserId];
                    return (
                      <button
                        key={share.id}
                        type="button"
                        className="agora-journal-row"
                        onClick={() => navigate(`/social/entrada/${share.journalEntryId}`)}
                      >
                        <div className="agora-journal-who">
                          <UserEmblem letter={share.fromLabel.slice(0, 1).toUpperCase()} size={32} />
                          <span className="agora-journal-name">{share.fromLabel}</span>
                          <RankBadge level={level} size="small" />
                        </div>
                        <div className="agora-journal-meta">
                          <span className="agora-journal-tag">Journal</span>
                          <span>{formatEntryDate(share.entryDate)}</span>
                        </div>
                        <span className="agora-chevron">→</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </section>
          )}

          {tab === 'archivos' && (
            <section className="panel plan-section">
              <div className="agora-file-toolbar">
                <label className="auth-field agora-file-search">
                  <span className="eyebrow">Buscar por quién subió</span>
                  <input
                    type="text"
                    value={fileQuery}
                    onChange={(event) => setFileQuery(event.target.value)}
                    placeholder="Nombre de usuario…"
                  />
                </label>

                <div className="agora-file-upload-bar">
                  <label className="auth-field">
                    <span className="eyebrow">Título (opcional)</span>
                    <input
                      type="text"
                      value={fileTitle}
                      onChange={(event) => setFileTitle(event.target.value)}
                      placeholder="¿De qué trata este archivo?"
                    />
                  </label>
                  <label className="primary-btn btn-sm agora-upload-btn">
                    {uploading ? 'Subiendo…' : '+ Subir archivo'}
                    <input
                      ref={fileInputRef}
                      type="file"
                      onChange={handleUploadFile}
                      disabled={uploading}
                      hidden
                    />
                  </label>
                </div>
              </div>

              {(filesError || fileMsg) && <p className="hint-text">{filesError ?? fileMsg}</p>}
              {filteredFiles.length === 0 ? (
                <p className="hint-text">
                  {files.length === 0
                    ? 'Nadie ha subido archivos a esta Ágora todavía.'
                    : 'Nada coincide con esa búsqueda.'}
                </p>
              ) : (
                <div className="repeatable-list">
                  {filteredFiles.map((file) => {
                    const level = memberStages[file.uploaderId];
                    return (
                      <div className="agora-file-row" key={file.id}>
                        <span className="agora-file-ext-chip">{fileExtension(file.fileName)}</span>
                        <div className="agora-file-info">
                          <div className="agora-file-uploader">
                            <span className="friend-avatar agora-file-avatar">
                              {file.uploaderLabel.slice(0, 2).toUpperCase()}
                            </span>
                            <span className="agora-file-uploader-name">{file.uploaderLabel}</span>
                            <RankBadge level={level} size="small" />
                          </div>
                          <span className="agora-file-name">{file.title || file.fileName}</span>
                          {file.title && <span className="hint-text">{file.fileName}</span>}
                          <span className="hint-text">
                            {formatDateTime(file.createdAt)} · {formatSize(file.sizeBytes)}
                          </span>
                        </div>
                        <div className="agora-file-actions">
                          <a className="ghost-btn btn-sm" href={file.url} target="_blank" rel="noreferrer">
                            Abrir
                          </a>
                          {(file.uploaderId === user?.id || canManageMembers) && (
                            <button type="button" className="ghost-btn btn-sm" onClick={() => handleRemoveFile(file)}>
                              Eliminar
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

export default AgoraDetail;
