import { useEffect, useState } from 'react';
import FundingAccountCard from '../components/FundingAccountCard';
import FundingHistoryModal from '../components/FundingHistoryModal';
import { useAuth } from '../contexts/AuthContext';
import {
  createFundingAccount,
  deleteFundingAccount,
  getFundingAccounts,
  updateFundingAccountBalance,
  type FundingAccount,
  type FundingAccountType,
  type FundingDrawdownType,
} from '../lib/api';

const accountTypeOptions: FundingAccountType[] = ['EVAL', 'PA'];
const drawdownTypeOptions: FundingDrawdownType[] = ['EOD', 'TRAILING', 'DAILY'];

function Conexiones() {
  const { user } = useAuth();

  const [accounts, setAccounts] = useState<FundingAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);

  const [formOpen, setFormOpen] = useState(false);
  const [accountName, setAccountName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountType, setAccountType] = useState<FundingAccountType>('PA');
  const [drawdownType, setDrawdownType] = useState<FundingDrawdownType>('EOD');
  const [startingBalance, setStartingBalance] = useState('');
  const [profitTarget, setProfitTarget] = useState('');
  const [drawdownLimit, setDrawdownLimit] = useState('');
  const [dailyLossLimit, setDailyLossLimit] = useState('');
  const [creating, setCreating] = useState(false);

  const loadAccounts = () => {
    if (!user) return;
    getFundingAccounts(user.id)
      .then(setAccounts)
      .catch((err) => setError(err instanceof Error ? err.message : 'No se pudieron cargar las cuentas.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadAccounts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const resetForm = () => {
    setAccountName('');
    setAccountNumber('');
    setAccountType('PA');
    setDrawdownType('EOD');
    setStartingBalance('');
    setProfitTarget('');
    setDrawdownLimit('');
    setDailyLossLimit('');
  };

  const handleCreate = async () => {
    if (!user) return;
    const starting = Number(startingBalance);
    const target = Number(profitTarget);
    const drawdown = Number(drawdownLimit);
    const dll = dailyLossLimit.trim() ? Number(dailyLossLimit) : null;
    if (!accountName.trim() || !Number.isFinite(starting) || !Number.isFinite(target) || !Number.isFinite(drawdown)) {
      setError('Completa todos los campos con valores válidos.');
      return;
    }

    setCreating(true);
    setError(null);
    try {
      const account = await createFundingAccount(user.id, {
        accountName: accountName.trim(),
        accountType,
        accountNumber: accountNumber.trim() || null,
        drawdownType,
        startingBalance: starting,
        profitTarget: target,
        drawdownLimit: drawdown,
        dailyLossLimit: dll,
      });
      setAccounts((current) => [account, ...current]);
      resetForm();
      setFormOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear la cuenta.');
    } finally {
      setCreating(false);
    }
  };

  const handleUpdateBalance = async (accountId: string, newBalance: number) => {
    await updateFundingAccountBalance(accountId, newBalance);
    setAccounts((current) =>
      current.map((account) => (account.id === accountId ? { ...account, currentBalance: newBalance } : account)),
    );
  };

  const handleDelete = async (accountId: string) => {
    try {
      await deleteFundingAccount(accountId);
      setAccounts((current) => current.filter((account) => account.id !== accountId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo eliminar la cuenta.');
    }
  };

  return (
    <>
      <header className="topbar panel">
        <div>
          <p className="eyebrow">Gestión de capital</p>
          <h2>Gestor de Cuentas de Fondeo</h2>
          <p className="page-description">
            Lleva el registro de tus cuentas activas — balance, meta de profit y límite de drawdown, todo en un
            solo lugar.
          </p>
        </div>
        <div className="funding-header-actions">
          <button type="button" className="ghost-btn btn-sm" onClick={() => setHistoryOpen(true)}>
            Historial
          </button>
          <button type="button" className="primary-btn btn-sm" onClick={() => setFormOpen((open) => !open)}>
            {formOpen ? 'Cancelar' : '+ Añadir Nueva Cuenta'}
          </button>
        </div>
      </header>

      {formOpen && (
        <section className="panel plan-section funding-form">
          <div className="field-grid-2">
            <label className="auth-field">
              <span className="eyebrow">Nombre de la cuenta</span>
              <input
                type="text"
                value={accountName}
                onChange={(event) => setAccountName(event.target.value)}
                placeholder="Ej. LUCIDPRO 50K"
              />
            </label>
            <label className="auth-field">
              <span className="eyebrow">Número de cuenta (opcional)</span>
              <input
                type="text"
                value={accountNumber}
                onChange={(event) => setAccountNumber(event.target.value)}
                placeholder="Ej. 123456"
              />
            </label>
            <label className="auth-field">
              <span className="eyebrow">Tipo de cuenta</span>
              <div className="pill-row">
                {accountTypeOptions.map((option) => (
                  <button
                    key={option}
                    type="button"
                    className={`pill-btn gold small ${accountType === option ? 'active' : ''}`}
                    onClick={() => setAccountType(option)}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </label>
            <label className="auth-field">
              <span className="eyebrow">Tipo de límite</span>
              <div className="pill-row">
                {drawdownTypeOptions.map((option) => (
                  <button
                    key={option}
                    type="button"
                    className={`pill-btn gold small ${drawdownType === option ? 'active' : ''}`}
                    onClick={() => setDrawdownType(option)}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </label>
            <label className="auth-field">
              <span className="eyebrow">Balance inicial</span>
              <input
                type="number"
                value={startingBalance}
                onChange={(event) => setStartingBalance(event.target.value)}
                placeholder="50000"
              />
            </label>
            <label className="auth-field">
              <span className="eyebrow">Meta a alcanzar (Profit Target)</span>
              <input
                type="number"
                value={profitTarget}
                onChange={(event) => setProfitTarget(event.target.value)}
                placeholder="53000"
              />
            </label>
            <label className="auth-field">
              <span className="eyebrow">Límite de pérdida (MLL)</span>
              <input
                type="number"
                value={drawdownLimit}
                onChange={(event) => setDrawdownLimit(event.target.value)}
                placeholder="47000"
              />
            </label>
            <label className="auth-field">
              <span className="eyebrow">Daily Loss Limit (opcional)</span>
              <input
                type="number"
                value={dailyLossLimit}
                onChange={(event) => setDailyLossLimit(event.target.value)}
                placeholder="1000"
              />
            </label>
          </div>
          <button type="button" className="primary-btn btn-sm" onClick={handleCreate} disabled={creating}>
            {creating ? 'Creando…' : 'Crear cuenta'}
          </button>
        </section>
      )}

      {error && <p className="hint-text">{error}</p>}

      {loading ? (
        <div className="skeleton skeleton-text" />
      ) : accounts.length === 0 ? (
        <div className="empty-state">
          <span className="empty-icon" />
          <h3>Aún no registras cuentas de fondeo</h3>
          <p>Agrega tu primera cuenta para llevar el seguimiento de tu progreso hacia la meta.</p>
        </div>
      ) : (
        <div className="funding-accounts-grid">
          {accounts.map((account) => (
            <FundingAccountCard
              key={account.id}
              account={account}
              onUpdateBalance={(newBalance) => handleUpdateBalance(account.id, newBalance)}
              onDelete={() => handleDelete(account.id)}
            />
          ))}
        </div>
      )}

      {user && (
        <FundingHistoryModal
          open={historyOpen}
          onClose={() => setHistoryOpen(false)}
          userId={user.id}
          accounts={accounts}
        />
      )}
    </>
  );
}

export default Conexiones;
