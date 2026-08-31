import { Link } from 'react-router-dom';
import type { FundingAccountTrend } from '../lib/api';
import { RISK_LOCK_DANGER_PCT } from '../lib/risk';

/**
 * Gestor de Riesgo — vive dentro del Tab Estado de Omega Coach. Muestra el
 * mismo % de riesgo que ya usa el candado de Omega en auditorías, más una
 * tendencia simple (últimos 7 días) a partir de funding_account_balance_events.
 */
function RiskManagerPanel({ accounts }: { accounts: FundingAccountTrend[] }) {
  return (
    <section className="panel plan-section">
      <div className="section-header">
        <h3 className="omega-section-title">Gestor de Riesgo</h3>
        <Link to="/conexiones" className="back-link">
          Ver Conexiones
        </Link>
      </div>

      {accounts.length === 0 ? (
        <p className="hint-text">
          No tenés cuentas activas registradas. Agregá una en <Link to="/conexiones">Conexiones</Link> para que Omega
          vigile su drawdown.
        </p>
      ) : (
        <div className="risk-account-list">
          {accounts.map((account) => {
            const atRisk = account.dangerPct >= RISK_LOCK_DANGER_PCT;
            return (
              <div key={account.id} className={`risk-account-row ${atRisk ? 'at-risk' : ''}`}>
                <div className="risk-account-header">
                  <strong>{account.accountName}</strong>
                  <span className={`risk-account-pct ${atRisk ? 'at-risk' : ''}`}>{account.dangerPct}%</span>
                </div>
                <div className="gauge-wrap">
                  <span
                    className="gauge-fill"
                    style={{
                      width: `${account.dangerPct}%`,
                      background: atRisk ? 'var(--trade-bearish)' : undefined,
                    }}
                  />
                </div>
                <p className="hint-text">
                  {account.recentDeltaPct === null
                    ? 'Sin movimientos registrados en los últimos 7 días.'
                    : `${account.recentDeltaPct > 0 ? '+' : ''}${account.recentDeltaPct}% en los últimos 7 días`}
                  {atRisk && ' — a menos del 20% de distancia de su límite de pérdida (MLL).'}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

export default RiskManagerPanel;
