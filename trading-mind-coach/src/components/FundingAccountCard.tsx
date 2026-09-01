import { useState } from 'react';
import type { FundingAccount } from '../lib/api';
import { computeDangerPct, RISK_LOCK_DANGER_PCT } from '../lib/risk';

function clampPct(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, value));
}

const STATUS_LABEL: Record<FundingAccount['status'], string> = {
  active: 'Active',
  breached: 'Breached',
  passed: 'Passed',
  inactive: 'Inactive',
};

function FundingAccountCard({
  account,
  onUpdateBalance,
  onDelete,
}: {
  account: FundingAccount;
  onUpdateBalance: (newBalance: number) => Promise<void>;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draftBalance, setDraftBalance] = useState(String(account.currentBalance));
  const [saving, setSaving] = useState(false);

  const { startingBalance, currentBalance, profitTarget, drawdownLimit, dailyLossLimit } = account;

  const sliderRange = profitTarget - drawdownLimit;
  const startPct = clampPct(((startingBalance - drawdownLimit) / sliderRange) * 100);
  const currentPct = clampPct(((currentBalance - drawdownLimit) / sliderRange) * 100);

  const dangerPct = computeDangerPct(startingBalance, currentBalance, drawdownLimit);
  const atRisk = dangerPct >= RISK_LOCK_DANGER_PCT;

  const handleSave = async () => {
    const parsed = Number(draftBalance);
    if (!Number.isFinite(parsed)) return;
    setSaving(true);
    try {
      await onUpdateBalance(parsed);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="funding-account-card">
      <div className="funding-account-header">
        <div className="funding-account-title-row">
          <h3>{account.accountName}</h3>
          <span className="funding-chip type">{account.accountType}</span>
          <span className="funding-chip type">{account.drawdownType} DRAWDOWN</span>
        </div>
        <button type="button" className="icon-btn" aria-label="Eliminar cuenta" onClick={onDelete}>
          ✕
        </button>
      </div>

      <div className="funding-account-subheader">
        {account.accountNumber && <span className="hint-text">#{account.accountNumber}</span>}
        <span className={`funding-chip status ${account.status}`}>{STATUS_LABEL[account.status]}</span>
        {dailyLossLimit !== null && <span className="funding-chip dll">DLL</span>}
        <span className={`funding-chip risk ${atRisk ? 'danger' : ''}`} title="% de distancia consumida hacia el límite de pérdida (MLL)">
          Drawdown {dangerPct}%
        </span>
      </div>

      <div className="funding-data-grid">
        <div className="funding-data-block">
          <span className="eyebrow">Account Balance</span>
          <strong>${currentBalance.toLocaleString()}</strong>
          <span className="hint-text">/ ${startingBalance.toLocaleString()} inicial</span>
        </div>
        <div className="funding-data-block">
          <span className="eyebrow">Profit Target</span>
          <strong>${(currentBalance - startingBalance).toLocaleString()}</strong>
          <span className="hint-text">/ ${(profitTarget - startingBalance).toLocaleString()} meta</span>
        </div>
        <div className="funding-data-block">
          <span className="eyebrow">Trading Days</span>
          <strong>{account.tradingDays}</strong>
        </div>
        <div className="funding-data-block">
          <span className="eyebrow">Daily Loss Limit</span>
          <strong>{dailyLossLimit !== null ? `$${dailyLossLimit.toLocaleString()}` : '—'}</strong>
        </div>
      </div>

      <div className="funding-slider">
        <div className="funding-slider-track">
          <div className="funding-slider-fill" style={{ width: `${startPct}%` }} />
          <span className="funding-slider-start-mark" style={{ left: `${startPct}%` }} />
          <span className="funding-slider-current-dot" style={{ left: `${currentPct}%` }} />
        </div>
        <div className="funding-slider-labels">
          <span className="funding-slider-label mll">MLL ${drawdownLimit.toLocaleString()}</span>
          <span className="funding-slider-label start">Start</span>
          <span className="funding-slider-label target">Target ${profitTarget.toLocaleString()}</span>
        </div>
      </div>

      {editing ? (
        <div className="funding-balance-edit">
          <input
            type="number"
            value={draftBalance}
            onChange={(event) => setDraftBalance(event.target.value)}
            autoFocus
          />
          <button type="button" className="primary-btn btn-sm" onClick={handleSave} disabled={saving}>
            {saving ? 'Guardando…' : 'Guardar'}
          </button>
          <button type="button" className="ghost-btn btn-sm" onClick={() => setEditing(false)} disabled={saving}>
            Cancelar
          </button>
        </div>
      ) : (
        <button
          type="button"
          className="ghost-btn btn-sm"
          onClick={() => {
            setDraftBalance(String(account.currentBalance));
            setEditing(true);
          }}
        >
          Actualizar Balance
        </button>
      )}
    </div>
  );
}

export default FundingAccountCard;
