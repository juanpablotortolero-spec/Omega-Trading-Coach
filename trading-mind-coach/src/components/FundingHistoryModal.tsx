import { useEffect, useState } from 'react';
import {
  createFundingPayout,
  getFundingAccountsSummary,
  getFundingPayouts,
  type FundingAccount,
  type FundingAccountsSummary,
  type FundingPayout,
} from '../lib/api';
import { localIsoDate } from '../lib/calendar';

function FundingHistoryModal({
  open,
  onClose,
  userId,
  accounts,
}: {
  open: boolean;
  onClose: () => void;
  userId: string;
  accounts: FundingAccount[];
}) {
  const [summary, setSummary] = useState<FundingAccountsSummary | null>(null);
  const [payouts, setPayouts] = useState<FundingPayout[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [amount, setAmount] = useState('');
  const [accountId, setAccountId] = useState('');
  const [payoutDate, setPayoutDate] = useState(localIsoDate(new Date()));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    Promise.all([getFundingAccountsSummary(userId), getFundingPayouts(userId)])
      .then(([summaryResult, payoutsResult]) => {
        if (cancelled) return;
        setSummary(summaryResult);
        setPayouts(payoutsResult);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'No se pudo cargar el historial.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, userId]);

  if (!open) return null;

  const handleAddPayout = async () => {
    const parsed = Number(amount);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setError('Ingresa un monto válido.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await createFundingPayout(userId, { accountId: accountId || null, amount: parsed, payoutDate });
      const [summaryResult, payoutsResult] = await Promise.all([
        getFundingAccountsSummary(userId),
        getFundingPayouts(userId),
      ]);
      setSummary(summaryResult);
      setPayouts(payoutsResult);
      setAmount('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo registrar el payout.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="info-modal-backdrop" onClick={onClose}>
      <div className="info-modal-panel" onClick={(event) => event.stopPropagation()}>
        <div className="info-modal-header">
          <h2>Historial de Cuentas</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Cerrar">
            ✕
          </button>
        </div>

        {loading && <div className="skeleton skeleton-text" />}

        {!loading && summary && (
          <section className="info-modal-section">
            <div className="funding-summary-grid">
              <div className="funding-summary-item">
                <span className="eyebrow">Cuentas Usadas</span>
                <strong>{summary.used}</strong>
              </div>
              <div className="funding-summary-item">
                <span className="eyebrow">Pasadas</span>
                <strong>{summary.passed}</strong>
              </div>
              <div className="funding-summary-item">
                <span className="eyebrow">Quemadas</span>
                <strong>{summary.breached}</strong>
              </div>
              <div className="funding-summary-item">
                <span className="eyebrow">Activas</span>
                <strong>{summary.active}</strong>
              </div>
              <div className="funding-summary-item">
                <span className="eyebrow">Inactivas</span>
                <strong>{summary.inactive}</strong>
              </div>
            </div>
          </section>
        )}

        <section className="info-modal-section">
          <h3>Registro de Retiros (Payouts)</h3>

          <div className="funding-payout-form">
            <input
              type="number"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              placeholder="Monto"
            />
            <select value={accountId} onChange={(event) => setAccountId(event.target.value)}>
              <option value="">Sin cuenta específica</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.accountName}
                </option>
              ))}
            </select>
            <input type="date" value={payoutDate} onChange={(event) => setPayoutDate(event.target.value)} />
            <button type="button" className="primary-btn btn-sm" onClick={handleAddPayout} disabled={saving}>
              {saving ? 'Guardando…' : 'Registrar'}
            </button>
          </div>

          {error && <p className="hint-text">{error}</p>}

          {payouts.length === 0 ? (
            <p className="hint-text">Aún no hay payouts registrados.</p>
          ) : (
            <div className="funding-payout-list">
              {payouts.map((payout) => (
                <div className="funding-payout-row" key={payout.id}>
                  <span>{payout.payoutDate}</span>
                  <span>{payout.accountName ?? 'Sin cuenta específica'}</span>
                  <strong>${payout.amount.toLocaleString()}</strong>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

export default FundingHistoryModal;
