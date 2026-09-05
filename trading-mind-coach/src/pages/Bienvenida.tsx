import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { autoGrow } from '../lib/autoGrow';
import OmegaMark from '../components/OmegaMark';
import {
  emptyTradingPlan,
  upsertTradingPlan,
  type GoalItem,
  type SetupItem,
  type TraderType,
  type TradingPlan as TradingPlanData,
} from '../lib/api';

const traderTypes: TraderType[] = ['Scalper', 'Day trader', 'Swing trader', 'Position trader'];

const STEP_TITLES = ['Perfil', 'Setups', 'Riesgo y gestión', 'Psicología y reglas', 'Objetivos', 'Notas adicionales'];

function newSetup(): SetupItem {
  return {
    id: crypto.randomUUID(),
    name: '',
    description: '',
    summary: '',
    historicalWinrate: '',
    qualityNotes: '',
    bestDays: [],
  };
}

function newGoal(): GoalItem {
  return { id: crypto.randomUUID(), text: '', type: 'manual', reward: '', progressPct: 0 };
}

const hasText = (value: string | null): boolean => !!value?.trim();

type Props = { onComplete: () => void };

function Bienvenida({ onComplete }: Props) {
  const { user } = useAuth();
  const [plan, setPlan] = useState<TradingPlanData>(emptyTradingPlan);
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = <K extends keyof TradingPlanData>(key: K, value: TradingPlanData[K]) => {
    setPlan((current) => ({ ...current, [key]: value }));
  };

  const canAdvance = (): boolean => {
    switch (step) {
      case 0:
        return (
          !!plan.trader_type &&
          hasText(plan.session_time) &&
          hasText(plan.schedule_start) &&
          hasText(plan.schedule_end) &&
          hasText(plan.max_trades_per_session) &&
          hasText(plan.no_trade_days)
        );
      case 1:
        return plan.setups.length > 0 && plan.setups.every((s) => s.name.trim() && s.description.trim());
      case 2:
        return (
          hasText(plan.risk_management) &&
          hasText(plan.position_management) &&
          hasText(plan.max_weekly_drawdown) &&
          hasText(plan.losing_streak_plan) &&
          hasText(plan.macro_event_plan)
        );
      case 3:
        return (
          hasText(plan.psychological_rules) &&
          hasText(plan.market_analysis_rules) &&
          hasText(plan.capital_preservation_rules)
        );
      case 4:
        return hasText(plan.payout_plan) && plan.goals.length > 0 && plan.goals.every((g) => g.text.trim());
      default:
        return true;
    }
  };

  /** Por qué "Siguiente" está deshabilitado — antes el botón se apagaba en silencio, sin decir qué falta. */
  const missingFieldsHint = (): string | null => {
    if (canAdvance()) return null;
    switch (step) {
      case 1:
        return plan.setups.length === 0
          ? 'Agrega al menos un setup para continuar.'
          : 'Completa el nombre y la descripción de cada setup para continuar.';
      case 4:
        if (!hasText(plan.payout_plan)) return 'Completa tu plan de retiros para continuar.';
        return plan.goals.length === 0
          ? 'Agrega al menos una meta para continuar.'
          : 'Completa el texto de cada meta para continuar.';
      default:
        return 'Completa todos los campos de este paso para continuar.';
    }
  };

  const finish = async (notes: string | null) => {
    if (!user) return;
    setSaving(true);
    setError(null);
    try {
      await upsertTradingPlan(user.id, { ...plan, extra_notes: notes });
      onComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar tu Manual Operativo.');
      setSaving(false);
    }
  };

  const goNext = () => {
    if (!canAdvance()) return;
    setStep((s) => Math.min(s + 1, STEP_TITLES.length - 1));
  };

  const goBack = () => setStep((s) => Math.max(s - 1, 0));

  const isLastStep = step === STEP_TITLES.length - 1;

  return (
    <div className="auth-shell">
      <div className="panel auth-card onboarding-card">
        <div className="brand-block">
          <div className="brand-mark">
            <OmegaMark size={44} />
          </div>
          <div>
            <h1>Bienvenido a Omega</h1>
            <p className="page-description">
              Antes de empezar, cuéntanos tu forma de operar — esto arma tu Manual Operativo y guía tus misiones
              y recordatorios diarios.
            </p>
          </div>
        </div>

        <div className="onboarding-progress">
          <span className="eyebrow">
            Paso {step + 1} de {STEP_TITLES.length} · {STEP_TITLES[step]}
          </span>
        </div>
        <div className="onboarding-progress-bar">
          <div
            className="onboarding-progress-fill"
            style={{ width: `${((step + 1) / STEP_TITLES.length) * 100}%` }}
          />
        </div>

        {step === 0 && (
          <div className="onboarding-step">
            <div className="pill-field">
              <span className="eyebrow">¿Qué tipo de trader eres?</span>
              <div className="pill-row">
                {traderTypes.map((type) => (
                  <button
                    key={type}
                    type="button"
                    className={`pill-btn gold ${plan.trader_type === type ? 'active' : ''}`}
                    onClick={() => set('trader_type', type)}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>

            <label className="auth-field">
              <span className="eyebrow">¿A qué hora debes estar en la computadora?</span>
              <textarea
                className="compact-textarea"
                rows={1}
                onInput={autoGrow}
                value={plan.session_time ?? ''}
                onChange={(event) => set('session_time', event.target.value)}
                placeholder="9:00am NY"
              />
            </label>

            <div className="field-grid-2">
              <label className="auth-field">
                <span className="eyebrow">Horario operativo — empieza</span>
                <input
                  type="text"
                  value={plan.schedule_start ?? ''}
                  onChange={(event) => set('schedule_start', event.target.value)}
                  placeholder="9:30"
                />
              </label>
              <label className="auth-field">
                <span className="eyebrow">Horario operativo — termina</span>
                <input
                  type="text"
                  value={plan.schedule_end ?? ''}
                  onChange={(event) => set('schedule_end', event.target.value)}
                  placeholder="11:00"
                />
              </label>
            </div>

            <label className="auth-field">
              <span className="eyebrow">¿Cuántos trades tienes permitidos por sesión?</span>
              <input
                type="text"
                value={plan.max_trades_per_session ?? ''}
                onChange={(event) => set('max_trades_per_session', event.target.value)}
                placeholder="1"
              />
            </label>

            <label className="auth-field">
              <span className="eyebrow">¿Hay días en los que no operas?</span>
              <textarea
                className="compact-textarea"
                rows={1}
                onInput={autoGrow}
                value={plan.no_trade_days ?? ''}
                onChange={(event) => set('no_trade_days', event.target.value)}
                placeholder="Ej. lunes, o semana de NFP — o 'No, opero todos los días hábiles'"
              />
            </label>
          </div>
        )}

        {step === 1 && (
          <div className="onboarding-step">
            <p className="hint-text">
              ¿Tienes setups definidos? Agrega cada uno por separado con sus reglas de entrada, su respaldo de
              backtesting y sus criterios de calidad.
            </p>

            <div className="repeatable-list">
              {plan.setups.map((setup, index) => (
                <div className="repeatable-card" key={setup.id}>
                  <div className="repeatable-card-header">
                    <span className="eyebrow">Setup {index + 1}</span>
                    <button
                      type="button"
                      className="icon-btn"
                      aria-label="Eliminar setup"
                      onClick={() => set('setups', plan.setups.filter((item) => item.id !== setup.id))}
                    >
                      ✕
                    </button>
                  </div>

                  <input
                    type="text"
                    value={setup.name}
                    onChange={(event) =>
                      set(
                        'setups',
                        plan.setups.map((item) =>
                          item.id === setup.id ? { ...item, name: event.target.value } : item,
                        ),
                      )
                    }
                    placeholder="Nombre del setup (ej. X-2C)"
                  />

                  <textarea
                    onInput={autoGrow}
                    value={setup.description}
                    onChange={(event) =>
                      set(
                        'setups',
                        plan.setups.map((item) =>
                          item.id === setup.id ? { ...item, description: event.target.value } : item,
                        ),
                      )
                    }
                    placeholder="Reglas detalladas de este setup, criterios de entrada…"
                    rows={4}
                  />

                  <label className="auth-field">
                    <span className="eyebrow">Backtesting — data que lo respalde</span>
                    <input
                      type="text"
                      value={setup.historicalWinrate}
                      onChange={(event) =>
                        set(
                          'setups',
                          plan.setups.map((item) =>
                            item.id === setup.id ? { ...item, historicalWinrate: event.target.value } : item,
                          ),
                        )
                      }
                      placeholder="Ej. 82.61% winrate sobre 120 muestras"
                    />
                  </label>

                  <label className="auth-field">
                    <span className="eyebrow">Clasificación de calidad de este setup (ej. A+, A, B)</span>
                    <textarea
                      onInput={autoGrow}
                      value={setup.qualityNotes}
                      onChange={(event) =>
                        set(
                          'setups',
                          plan.setups.map((item) =>
                            item.id === setup.id ? { ...item, qualityNotes: event.target.value } : item,
                          ),
                        )
                      }
                      placeholder="Parámetros de cada tier de calidad para este setup…"
                      rows={3}
                    />
                  </label>
                </div>
              ))}
            </div>

            <button type="button" className="ghost-btn add-item-btn" onClick={() => set('setups', [...plan.setups, newSetup()])}>
              + Agregar setup
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="onboarding-step">
            <label className="auth-field">
              <span className="eyebrow">Gestión de riesgo — ¿cuánto arriesgas por operación?</span>
              <textarea
                onInput={autoGrow}
                value={plan.risk_management ?? ''}
                onChange={(event) => set('risk_management', event.target.value)}
                rows={3}
              />
            </label>

            <label className="auth-field">
              <span className="eyebrow">Gestión de la posición en vivo</span>
              <textarea
                onInput={autoGrow}
                value={plan.position_management ?? ''}
                onChange={(event) => set('position_management', event.target.value)}
                placeholder="Si cambia según el modelo/setup, explica cada caso por separado…"
                rows={4}
              />
            </label>

            <label className="auth-field">
              <span className="eyebrow">Drawdown semanal máximo</span>
              <textarea
                onInput={autoGrow}
                value={plan.max_weekly_drawdown ?? ''}
                onChange={(event) => set('max_weekly_drawdown', event.target.value)}
                rows={2}
              />
            </label>

            <label className="auth-field">
              <span className="eyebrow">Gestión de rachas negativas semanales</span>
              <textarea
                onInput={autoGrow}
                value={plan.losing_streak_plan ?? ''}
                onChange={(event) => set('losing_streak_plan', event.target.value)}
                rows={3}
              />
            </label>

            <label className="auth-field">
              <span className="eyebrow">Manejo de eventos macroeconómicos en tu sesión</span>
              <textarea
                onInput={autoGrow}
                value={plan.macro_event_plan ?? ''}
                onChange={(event) => set('macro_event_plan', event.target.value)}
                rows={3}
              />
            </label>
          </div>
        )}

        {step === 3 && (
          <div className="onboarding-step">
            <label className="auth-field">
              <span className="eyebrow">Reglas psicológicas en las que te apoyas</span>
              <textarea
                onInput={autoGrow}
                value={plan.psychological_rules ?? ''}
                onChange={(event) => set('psychological_rules', event.target.value)}
                rows={4}
              />
            </label>

            <label className="auth-field">
              <span className="eyebrow">Reglas para analizar el mercado en tu sesión</span>
              <textarea
                onInput={autoGrow}
                value={plan.market_analysis_rules ?? ''}
                onChange={(event) => set('market_analysis_rules', event.target.value)}
                rows={4}
              />
            </label>

            <label className="auth-field">
              <span className="eyebrow">Reglas que te ayudan a conservar tu capital</span>
              <textarea
                onInput={autoGrow}
                value={plan.capital_preservation_rules ?? ''}
                onChange={(event) => set('capital_preservation_rules', event.target.value)}
                placeholder="Condiciones que anulan tu setup o que te hacen irte de la PC…"
                rows={4}
              />
            </label>
          </div>
        )}

        {step === 4 && (
          <div className="onboarding-step">
            <label className="auth-field">
              <span className="eyebrow">Plan de payouts</span>
              <textarea
                onInput={autoGrow}
                value={plan.payout_plan ?? ''}
                onChange={(event) => set('payout_plan', event.target.value)}
                placeholder="Cómo organizas tus retiros cuando llegues a ese punto…"
                rows={3}
              />
            </label>

            <p className="hint-text">¿Tienes objetivos o metas que quisieras lograr en el trading?</p>

            <div className="repeatable-list">
              {plan.goals.map((goal, index) => (
                <div className="repeatable-card" key={goal.id}>
                  <div className="repeatable-card-header">
                    <span className="eyebrow">Meta {index + 1}</span>
                    <button
                      type="button"
                      className="icon-btn"
                      aria-label="Eliminar meta"
                      onClick={() => set('goals', plan.goals.filter((item) => item.id !== goal.id))}
                    >
                      ✕
                    </button>
                  </div>

                  <textarea
                    className="compact-textarea"
                    rows={1}
                    onInput={autoGrow}
                    value={goal.text}
                    onChange={(event) =>
                      set(
                        'goals',
                        plan.goals.map((item) => (item.id === goal.id ? { ...item, text: event.target.value } : item)),
                      )
                    }
                    placeholder="Ej. seguir mis reglas, pasar una cuenta challenge, retirar…"
                  />

                  <input
                    type="text"
                    value={goal.reward}
                    onChange={(event) =>
                      set(
                        'goals',
                        plan.goals.map((item) =>
                          item.id === goal.id ? { ...item, reward: event.target.value } : item,
                        ),
                      )
                    }
                    placeholder="Recompensa (opcional)"
                  />
                </div>
              ))}
            </div>

            <button type="button" className="ghost-btn add-item-btn" onClick={() => set('goals', [...plan.goals, newGoal()])}>
              + Agregar meta
            </button>
          </div>
        )}

        {step === 5 && (
          <div className="onboarding-step">
            <label className="auth-field">
              <span className="eyebrow">¿Alguna otra regla, parámetro o criterio personal?</span>
              <textarea
                onInput={autoGrow}
                value={plan.extra_notes ?? ''}
                onChange={(event) => set('extra_notes', event.target.value)}
                placeholder="Opcional — puedes omitir este paso"
                rows={4}
              />
            </label>
          </div>
        )}

        {error && <p className="auth-message error">{error}</p>}

        <div className="onboarding-nav">
          <button type="button" className="ghost-btn btn-sm" onClick={goBack} disabled={step === 0 || saving}>
            Atrás
          </button>

          {isLastStep ? (
            <div className="onboarding-nav-end">
              <button type="button" className="ghost-btn btn-sm" onClick={() => finish(null)} disabled={saving}>
                Omitir
              </button>
              <button
                type="button"
                className="primary-btn btn-sm"
                onClick={() => finish(plan.extra_notes?.trim() || null)}
                disabled={saving}
              >
                {saving ? 'Guardando…' : 'Finalizar'}
              </button>
            </div>
          ) : (
            <div className="onboarding-nav-end">
              {!canAdvance() && <span className="hint-text">{missingFieldsHint()}</span>}
              <button
                type="button"
                className="primary-btn btn-sm"
                onClick={goNext}
                disabled={!canAdvance()}
                title={missingFieldsHint() ?? undefined}
              >
                Siguiente
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Bienvenida;
