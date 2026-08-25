import { useEffect, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { autoGrow } from '../lib/autoGrow';
import {
  addEntryFeedback,
  getEntryFeedback,
  getJournalEntryById,
  getOperations,
  getProfileLabel,
  type FeedbackItem,
  type JournalEntryFull,
  type OperationItem,
} from '../lib/api';

function formatMoney(value: number | null) {
  if (value === null) return '—';
  const sign = value > 0 ? '+' : '';
  return `${sign}$${value.toFixed(2)}`;
}

function SharedEntry() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();

  const [entry, setEntry] = useState<(JournalEntryFull & { userId: string }) | null>(null);
  const [ownerLabel, setOwnerLabel] = useState('');
  const [operations, setOperations] = useState<OperationItem[]>([]);
  const [feedback, setFeedback] = useState<FeedbackItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  const load = async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const found = await getJournalEntryById(id);
      if (!found) {
        setError('No se encontró esta entrada, o no tienes permiso para verla.');
        return;
      }
      const [label, ops, feedbackList] = await Promise.all([
        getProfileLabel(found.userId),
        getOperations(id),
        getEntryFeedback(id),
      ]);
      setEntry(found);
      setOwnerLabel(label);
      setOperations(ops);
      setFeedback(feedbackList);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar la entrada.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const handleSubmitFeedback = async (event: FormEvent) => {
    event.preventDefault();
    if (!user || !id || !message.trim()) return;

    setSending(true);
    try {
      await addEntryFeedback(id, user.id, message.trim());
      setMessage('');
      const feedbackList = await getEntryFeedback(id);
      setFeedback(feedbackList);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo enviar el feedback.');
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return <div className="skeleton skeleton-table" />;
  }

  if (error || !entry) {
    return (
      <section className="panel plan-section">
        <Link to="/buzon" className="back-link">
          ← Volver al Buzón
        </Link>
        <div className="empty-state">
          <span className="empty-icon" />
          <h3>{error ?? 'Entrada no disponible'}</h3>
        </div>
      </section>
    );
  }

  return (
    <>
      <header className="topbar panel">
        <div>
          <Link to="/buzon" className="back-link">
            ← Volver al Buzón
          </Link>
          <p className="eyebrow" style={{ marginTop: 10 }}>
            Journal compartido de {ownerLabel}
          </p>
          <h2>{new Date(`${entry.entry_date}T00:00:00`).toLocaleDateString('es-ES', { dateStyle: 'long' })}</h2>
        </div>
      </header>

      <section className="panel plan-section">
        <div className="field-grid-2">
          <div>
            <span className="eyebrow">Estado emocional</span>
            <p>{entry.emotional_state ?? '—'}</p>
          </div>
          <div>
            <span className="eyebrow">Escenario</span>
            <p>{entry.scenario_id ?? '—'}</p>
          </div>
        </div>
        <div>
          <span className="eyebrow">Directriz operativa</span>
          <p>{entry.directriz || '—'}</p>
        </div>
        <div>
          <span className="eyebrow">Análisis técnico post-mercado</span>
          <p>{entry.post_market_analysis || '—'}</p>
        </div>
      </section>

      <section className="panel plan-section">
        <h3>Operaciones</h3>
        {operations.length === 0 ? (
          <p className="hint-text">Sin operaciones registradas ese día.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Símbolo</th>
                  <th>Dirección</th>
                  <th>Modelo</th>
                  <th>Calidad</th>
                  <th>P&L</th>
                  <th>Lección</th>
                </tr>
              </thead>
              <tbody>
                {operations.map((op) => (
                  <tr key={op.id}>
                    <td>{op.symbol}</td>
                    <td className={op.direction === 'long' ? 'bullish' : 'bearish'}>
                      {op.direction === 'long' ? 'Long' : 'Short'}
                    </td>
                    <td>{op.model || '—'}</td>
                    <td>{op.quality ?? '—'}</td>
                    <td className={op.pnl ? (Number(op.pnl) >= 0 ? 'bullish' : 'bearish') : ''}>
                      {formatMoney(op.pnl ? Number(op.pnl) : null)}
                    </td>
                    <td>{op.lesson || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="panel plan-section">
        <h3>Feedback</h3>
        {feedback.length === 0 ? (
          <p className="hint-text">Sé el primero en dejar feedback.</p>
        ) : (
          <div className="repeatable-list">
            {feedback.map((item) => (
              <div className="repeatable-card" key={item.id}>
                <div className="repeatable-card-header">
                  <span className="eyebrow">{item.authorLabel}</span>
                </div>
                <p>{item.message}</p>
              </div>
            ))}
          </div>
        )}

        <form className="share-row" onSubmit={handleSubmitFeedback} style={{ marginTop: 16 }}>
          <label className="auth-field" style={{ flex: 1 }}>
            <textarea
              onInput={autoGrow}
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder="Deja tu feedback…"
              rows={2}
            />
          </label>
          <button type="submit" className="primary-btn" disabled={sending || !message.trim()}>
            {sending ? 'Enviando…' : 'Enviar'}
          </button>
        </form>
      </section>
    </>
  );
}

export default SharedEntry;
