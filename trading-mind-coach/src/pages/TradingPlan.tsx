import { useEffect, useRef, useState } from 'react';
import TradingPlanInfoModal from '../components/TradingPlanInfoModal';
import { useAuth } from '../contexts/AuthContext';
import { autoGrow } from '../lib/autoGrow';
import {
  defaultTemplateSections,
  emptyTradingPlan,
  getJournalTemplate,
  getTradingPlan,
  upsertJournalTemplate,
  upsertTradingPlan,
  type GoalItem,
  type JournalTemplateSections,
  type ScenarioItem,
  type SetupItem,
  type TraderType,
  type TradingPlan as TradingPlanData,
} from '../lib/api';

const traderTypes: TraderType[] = ['Scalper', 'Day trader', 'Swing trader', 'Position trader'];
const weekdayLabels = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie'];
type PlanTab = 'plan' | 'personalizacion';

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

function newScenario(): ScenarioItem {
  return { id: crypto.randomUUID(), name: '', description: '' };
}

function newGoal(): GoalItem {
  return { id: crypto.randomUUID(), text: '', type: 'manual', reward: '', progressPct: 0 };
}

function TradingPlan() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<PlanTab>('plan');
  const [infoOpen, setInfoOpen] = useState(false);
  const [plan, setPlan] = useState<TradingPlanData>(emptyTradingPlan);
  const [template, setTemplate] = useState<JournalTemplateSections>(defaultTemplateSections());
  const [loading, setLoading] = useState(true);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const skipNextSave = useRef(true);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipNextTemplateSave = useRef(true);
  const templateSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    Promise.all([getTradingPlan(user.id), getJournalTemplate(user.id)]).then(([planData, templateData]) => {
      if (cancelled) return;
      if (planData) setPlan(planData);
      setTemplate(templateData);
      skipNextSave.current = true;
      skipNextTemplateSave.current = true;
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [user]);

  useEffect(() => {
    if (!user || loading) return;
    if (skipNextSave.current) {
      skipNextSave.current = false;
      return;
    }

    if (saveTimer.current) clearTimeout(saveTimer.current);
    setSaveState('saving');

    saveTimer.current = setTimeout(() => {
      upsertTradingPlan(user.id, plan)
        .then(() => setSaveState('saved'))
        .catch(() => setSaveState('error'));
    }, 800);

    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan, user, loading]);

  useEffect(() => {
    if (!user || loading) return;
    if (skipNextTemplateSave.current) {
      skipNextTemplateSave.current = false;
      return;
    }

    if (templateSaveTimer.current) clearTimeout(templateSaveTimer.current);
    setSaveState('saving');

    templateSaveTimer.current = setTimeout(() => {
      upsertJournalTemplate(user.id, template)
        .then(() => setSaveState('saved'))
        .catch(() => setSaveState('error'));
    }, 800);

    return () => {
      if (templateSaveTimer.current) clearTimeout(templateSaveTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [template, user, loading]);

  const set = <K extends keyof TradingPlanData>(key: K, value: TradingPlanData[K]) => {
    setPlan((current) => ({ ...current, [key]: value }));
  };

  const updateTemplateField = (group: 'htf' | 'ltf', index: number, value: string) => {
    setTemplate((current) => ({
      ...current,
      [group]: current[group].map((field, i) => (i === index ? value : field)),
    }));
  };

  const addTemplateField = (group: 'htf' | 'ltf') => {
    setTemplate((current) => ({ ...current, [group]: [...current[group], ''] }));
  };

  const removeTemplateField = (group: 'htf' | 'ltf', index: number) => {
    setTemplate((current) => ({ ...current, [group]: current[group].filter((_, i) => i !== index) }));
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
          aria-label="Cómo funciona el Manual Operativo"
        >
          ℹ
        </button>
        <div>
          <p className="eyebrow">Configuración</p>
          <h2>Manual Operativo</h2>
          <p className="page-description">
            El corazón de tu sistema: tu plan, tus reglas y tus objetivos. Todo lo que escribas aquí guía tus
            misiones y recordatorios diarios.
          </p>
        </div>
        <span className={`save-status ${saveState}`}>
          {saveState === 'saving' && 'Guardando…'}
          {saveState === 'saved' && 'Guardado'}
          {saveState === 'error' && 'Error al guardar'}
          {saveState === 'idle' && 'Todo se guarda automáticamente'}
        </span>
      </header>

      <div className="plan-tabs">
        <button
          type="button"
          className={`plan-tab ${activeTab === 'plan' ? 'active' : ''}`}
          onClick={() => setActiveTab('plan')}
        >
          Plan
        </button>
        <button
          type="button"
          className={`plan-tab ${activeTab === 'personalizacion' ? 'active' : ''}`}
          onClick={() => setActiveTab('personalizacion')}
        >
          Personalización
        </button>
      </div>

      {activeTab === 'personalizacion' ? (
        <section className="panel plan-section tp-section">
          <h3>Personaliza tu Journal</h3>
          <p className="page-description">
            Elige qué campos quieres ver en el Top-Down de tu journal diario. Agrega, renombra o elimina los
            que no uses — se aplican la próxima vez que abras "Nuevo journal".
          </p>

          <div className="template-field-group">
            <h4>Top Down (HTF)</h4>
            <div className="repeatable-list">
              {template.htf.map((field, index) => (
                <div className="template-field-row" key={`htf-${index}`}>
                  <input
                    type="text"
                    value={field}
                    onChange={(event) => updateTemplateField('htf', index, event.target.value)}
                    placeholder="Nombre del campo"
                  />
                  <button
                    type="button"
                    className="icon-btn"
                    aria-label="Eliminar campo"
                    onClick={() => removeTemplateField('htf', index)}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
            <button type="button" className="ghost-btn add-item-btn" onClick={() => addTemplateField('htf')}>
              + Agregar campo HTF
            </button>
          </div>

          <div className="template-field-group">
            <h4>Top Down (LTF)</h4>
            <div className="repeatable-list">
              {template.ltf.map((field, index) => (
                <div className="template-field-row" key={`ltf-${index}`}>
                  <input
                    type="text"
                    value={field}
                    onChange={(event) => updateTemplateField('ltf', index, event.target.value)}
                    placeholder="Nombre del campo"
                  />
                  <button
                    type="button"
                    className="icon-btn"
                    aria-label="Eliminar campo"
                    onClick={() => removeTemplateField('ltf', index)}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
            <button type="button" className="ghost-btn add-item-btn" onClick={() => addTemplateField('ltf')}>
              + Agregar campo LTF
            </button>
          </div>
        </section>
      ) : (
        <>
      <section className="panel plan-section tp-section">
        <h3>Perfil</h3>

        <div className="pill-field">
          <span className="eyebrow">Tipo de trader</span>
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

        <div className="pill-field">
          <span className="eyebrow">¿Operas Criptomonedas?</span>
          <div className="pill-row">
            <button
              type="button"
              className={`pill-btn gold ${plan.trades_crypto ? 'active' : ''}`}
              onClick={() => set('trades_crypto', true)}
            >
              Sí
            </button>
            <button
              type="button"
              className={`pill-btn gold ${!plan.trades_crypto ? 'active' : ''}`}
              onClick={() => set('trades_crypto', false)}
            >
              No
            </button>
          </div>
          <p className="hint-text">
            El mercado cripto opera 24/7. Si respondes "No", tu racha de días operativos no se rompe los fines de
            semana — solo cuenta de lunes a viernes.
          </p>
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
            <span className="eyebrow">Horario — empieza</span>
            <input
              type="text"
              value={plan.schedule_start ?? ''}
              onChange={(event) => set('schedule_start', event.target.value)}
              placeholder="9:30"
            />
          </label>
          <label className="auth-field">
            <span className="eyebrow">Horario — termina</span>
            <input
              type="text"
              value={plan.schedule_end ?? ''}
              onChange={(event) => set('schedule_end', event.target.value)}
              placeholder="11:00"
            />
          </label>
        </div>

        <label className="auth-field">
          <span className="eyebrow">Trades permitidos por sesión</span>
          <input
            type="text"
            value={plan.max_trades_per_session ?? ''}
            onChange={(event) => set('max_trades_per_session', event.target.value)}
            placeholder="1"
          />
        </label>

        <label className="auth-field">
          <span className="eyebrow">Días en los que no operas</span>
          <textarea
            className="compact-textarea"
            rows={1}
            onInput={autoGrow}
            value={plan.no_trade_days ?? ''}
            onChange={(event) => set('no_trade_days', event.target.value)}
            placeholder="Lunes, jueves y viernes de semana NFP…"
          />
        </label>
      </section>

      <section className="panel plan-section tp-section">
        <div className="section-header">
          <h3>Setups</h3>
        </div>

        <div className="pill-field">
          <span className="eyebrow">Calidades de Setup</span>
          <p className="hint-text">
            Las opciones que verás al calificar cada operación en tu journal (ej. A+, A, B).
          </p>
          <div className="pill-row">
            {plan.quality_tiers.map((tier, index) => (
              <span className="tier-chip" key={`${tier}-${index}`}>
                <input
                  type="text"
                  value={tier}
                  onChange={(event) =>
                    set(
                      'quality_tiers',
                      plan.quality_tiers.map((t, i) => (i === index ? event.target.value : t)),
                    )
                  }
                />
                <button
                  type="button"
                  className="icon-btn"
                  aria-label="Eliminar calidad"
                  onClick={() =>
                    set(
                      'quality_tiers',
                      plan.quality_tiers.filter((_, i) => i !== index),
                    )
                  }
                >
                  ✕
                </button>
              </span>
            ))}
            <button
              type="button"
              className="ghost-btn"
              onClick={() => set('quality_tiers', [...plan.quality_tiers, 'Nueva'])}
            >
              + Agregar
            </button>
          </div>
        </div>

        <div className="repeatable-list">
          {plan.setups.map((setup, index) => (
            <div className="repeatable-card" key={setup.id}>
              <div className="repeatable-card-header">
                <span className="eyebrow">Setup {index + 1}</span>
                <button
                  type="button"
                  className="icon-btn"
                  aria-label="Eliminar setup"
                  onClick={() =>
                    set(
                      'setups',
                      plan.setups.filter((item) => item.id !== setup.id),
                    )
                  }
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
                placeholder="Descripción del setup, criterios de entrada…"
                rows={4}
              />

              <div className="field-grid-2">
                <textarea
                  className="compact-textarea"
                  rows={1}
                  onInput={autoGrow}
                  value={setup.summary}
                  onChange={(event) =>
                    set(
                      'setups',
                      plan.setups.map((item) =>
                        item.id === setup.id ? { ...item, summary: event.target.value } : item,
                      ),
                    )
                  }
                  placeholder="Setups A+  LQ GRAB (HTF) + HTF PD Array…"
                />
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
                  placeholder="82.61%"
                />
              </div>

              <label className="auth-field">
                <span className="eyebrow">Calidad de Setups (A+, A y B)</span>
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
                  placeholder="Criterios de cada tier (A+, A, B) y su rango horario ideal…"
                  rows={4}
                />
              </label>

              <div className="pill-field">
                <span className="eyebrow">Mejores días</span>
                <div className="pill-row">
                  {weekdayLabels.map((label, dayIndex) => (
                    <button
                      key={label}
                      type="button"
                      className={`pill-btn gold small ${setup.bestDays.includes(dayIndex) ? 'active' : ''}`}
                      onClick={() =>
                        set(
                          'setups',
                          plan.setups.map((item) =>
                            item.id === setup.id
                              ? {
                                  ...item,
                                  bestDays: item.bestDays.includes(dayIndex)
                                    ? item.bestDays.filter((d) => d !== dayIndex)
                                    : [...item.bestDays, dayIndex],
                                }
                              : item,
                          ),
                        )
                      }
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>

        <button
          type="button"
          className="ghost-btn add-item-btn"
          onClick={() => set('setups', [...plan.setups, newSetup()])}
        >
          + Agregar setup
        </button>
      </section>

      <section className="panel plan-section tp-section">
        <div className="section-header">
          <div>
            <h3>Escenarios</h3>
            <p className="hint-text">Tus propios escenarios de mercado (ej. tu Time Delivery Sequence)</p>
          </div>
        </div>

        <div className="repeatable-list">
          {plan.scenarios.map((scenario, index) => (
            <div className="repeatable-card" key={scenario.id}>
              <div className="repeatable-card-header">
                <span className="eyebrow">Escenario {index + 1}</span>
                <button
                  type="button"
                  className="icon-btn"
                  aria-label="Eliminar escenario"
                  onClick={() =>
                    set(
                      'scenarios',
                      plan.scenarios.filter((item) => item.id !== scenario.id),
                    )
                  }
                >
                  ✕
                </button>
              </div>
              <input
                type="text"
                value={scenario.name}
                onChange={(event) =>
                  set(
                    'scenarios',
                    plan.scenarios.map((item) =>
                      item.id === scenario.id ? { ...item, name: event.target.value } : item,
                    ),
                  )
                }
                placeholder="Nombre del escenario"
              />
              <textarea
                onInput={autoGrow}
                value={scenario.description}
                onChange={(event) =>
                  set(
                    'scenarios',
                    plan.scenarios.map((item) =>
                      item.id === scenario.id ? { ...item, description: event.target.value } : item,
                    ),
                  )
                }
                placeholder="Describe el escenario…"
                rows={3}
              />
            </div>
          ))}
        </div>

        <button
          type="button"
          className="ghost-btn add-item-btn"
          onClick={() => set('scenarios', [...plan.scenarios, newScenario()])}
        >
          + Agregar escenario
        </button>
      </section>

      <section className="panel plan-section tp-section">
        <h3>Riesgo y gestión</h3>

        <label className="auth-field">
          <span className="eyebrow">Gestión de riesgo por operación</span>
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
          <span className="eyebrow">Gestión de rachas negativas</span>
          <textarea
            onInput={autoGrow}
            value={plan.losing_streak_plan ?? ''}
            onChange={(event) => set('losing_streak_plan', event.target.value)}
            rows={3}
          />
        </label>

        <label className="auth-field">
          <span className="eyebrow">Manejo de eventos macroeconómicos</span>
          <textarea
            onInput={autoGrow}
            value={plan.macro_event_plan ?? ''}
            onChange={(event) => set('macro_event_plan', event.target.value)}
            rows={3}
          />
        </label>
      </section>

      <section className="panel plan-section tp-section">
        <h3>Psicología y reglas</h3>

        <label className="auth-field">
          <span className="eyebrow">Reglas psicológicas</span>
          <textarea
            onInput={autoGrow}
            value={plan.psychological_rules ?? ''}
            onChange={(event) => set('psychological_rules', event.target.value)}
            rows={4}
          />
        </label>

        <label className="auth-field">
          <span className="eyebrow">Reglas de análisis de mercado</span>
          <textarea
            onInput={autoGrow}
            value={plan.market_analysis_rules ?? ''}
            onChange={(event) => set('market_analysis_rules', event.target.value)}
            rows={4}
          />
        </label>

        <label className="auth-field">
          <span className="eyebrow">Reglas de preservación de capital</span>
          <textarea
            onInput={autoGrow}
            value={plan.capital_preservation_rules ?? ''}
            onChange={(event) => set('capital_preservation_rules', event.target.value)}
            rows={4}
          />
        </label>
      </section>

      <section className="panel plan-section tp-section">
        <h3>Objetivos</h3>

        <label className="auth-field">
          <span className="eyebrow">Plan de payouts</span>
          <textarea
            onInput={autoGrow}
            value={plan.payout_plan ?? ''}
            onChange={(event) => set('payout_plan', event.target.value)}
            rows={3}
          />
        </label>

        <div className="repeatable-list">
          {plan.goals.map((goal, index) => (
            <div className="repeatable-card" key={goal.id}>
              <div className="repeatable-card-header">
                <span className="eyebrow">Meta {index + 1}</span>
                <button
                  type="button"
                  className="icon-btn"
                  aria-label="Eliminar meta"
                  onClick={() =>
                    set(
                      'goals',
                      plan.goals.filter((item) => item.id !== goal.id),
                    )
                  }
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
                    plan.goals.map((item) =>
                      item.id === goal.id ? { ...item, text: event.target.value } : item,
                    ),
                  )
                }
                placeholder="ej. pasar mi primera cuenta fondeada"
              />

              <div className="field-grid-2">
                <div className="pill-row">
                  <button
                    type="button"
                    className={`pill-btn gold small ${goal.type === 'manual' ? 'active' : ''}`}
                    onClick={() =>
                      set(
                        'goals',
                        plan.goals.map((item) => (item.id === goal.id ? { ...item, type: 'manual' } : item)),
                      )
                    }
                  >
                    Meta manual
                  </button>
                  <button
                    type="button"
                    className={`pill-btn gold small ${goal.type === 'automatic' ? 'active' : ''}`}
                    onClick={() =>
                      set(
                        'goals',
                        plan.goals.map((item) =>
                          item.id === goal.id ? { ...item, type: 'automatic' } : item,
                        ),
                      )
                    }
                  >
                    Meta automática
                  </button>
                </div>
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
                  placeholder="Recompensa"
                />
              </div>

              <div className="progress-field">
                <div className="stat-header">
                  <span className="eyebrow">Progreso manual</span>
                  <span>{goal.progressPct}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={goal.progressPct}
                  onChange={(event) =>
                    set(
                      'goals',
                      plan.goals.map((item) =>
                        item.id === goal.id ? { ...item, progressPct: Number(event.target.value) } : item,
                      ),
                    )
                  }
                />
              </div>
            </div>
          ))}
        </div>

        <button
          type="button"
          className="ghost-btn add-item-btn"
          onClick={() => set('goals', [...plan.goals, newGoal()])}
        >
          + Agregar meta
        </button>
      </section>

      <section className="panel plan-section tp-section">
        <h3>Notas adicionales</h3>
        <textarea
          onInput={autoGrow}
          value={plan.extra_notes ?? ''}
          onChange={(event) => set('extra_notes', event.target.value)}
          placeholder="Otras reglas, parámetros o criterios personales"
          rows={4}
        />
      </section>
        </>
      )}

      <TradingPlanInfoModal open={infoOpen} onClose={() => setInfoOpen(false)} />
    </>
  );
}

export default TradingPlan;
