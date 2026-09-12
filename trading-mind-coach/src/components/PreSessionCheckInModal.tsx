import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useRefresh } from '../contexts/RefreshContext';
import { acknowledgeBriefing, getTodayBriefingAckStatus, savePreSessionResponse, type PreSessionResponseInput } from '../lib/api';
import { localIsoDate } from '../lib/calendar';
import BriefingPreSesion from './BriefingPreSesion';
import OmegaMark from './OmegaMark';

type Step = 'quiz' | 'briefing';

const FEELING_OPTIONS = ['Enfocado y motivado', 'Neutral', 'Agitado o ansioso', 'Distraído o estresado'];

const WHY_TRADING_OPTIONS = [
  'Vengo bien — quiero capitalizar el momento',
  'Es mi horario habitual de sesión',
  'Aburrido — no tengo nada más que hacer',
  'Necesito recuperar pérdidas recientes',
];

const MINDSET_OPTIONS = [
  'Quiero mantener el impulso',
  'Arranco de cero — la sesión pasada no cambia mi enfoque',
  'Con confianza, pero sin salirme del plan',
  'Me siento más agudo — podría buscar más operaciones',
];

const INTENTION_OPTIONS = [
  'Respetar mi plan al pie de la letra',
  'No promediar en contra',
  'Salir apenas rompa una regla',
  'Operar solo mi setup A+',
  'Parar después de 2 pérdidas seguidas',
];

const QUIZ_STEP_COUNT = 4;

/**
 * Gate de aceptación del briefing — vive DENTRO del modal (a diferencia de
 * antes, que estaba en OmegaDashboard) porque ahora el trader tiene que
 * leerlo y aceptarlo acá para que MainLayout destrabe "Nuevo journal" (ver
 * briefingAcknowledgedToday en MainLayout.tsx, misma tabla omega_briefings).
 */
function PreSessionBriefingGate({ onAccepted }: { onAccepted: () => void }) {
  const { user } = useAuth();
  const todayIso = localIsoDate(new Date());

  const [ack, setAck] = useState<{ exists: boolean; acknowledged: boolean }>({ exists: false, acknowledged: false });
  const [acknowledging, setAcknowledging] = useState(false);

  // El briefing se genera/guarda de forma local en BriefingPreSesion — acá
  // solo se sondea cada segundo hasta que la fila exista, sin depender de
  // ningún estado "sending" compartido (ya no hay Edge Function de por medio).
  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    const check = () => {
      getTodayBriefingAckStatus(user.id, todayIso).then((status) => {
        if (cancelled) return;
        setAck(status);
      });
    };

    check();
    const interval = setInterval(check, 1000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const handleAccept = async () => {
    if (!user || acknowledging) return;
    setAcknowledging(true);
    try {
      await acknowledgeBriefing(user.id, todayIso);
      onAccepted();
    } catch {
      // Silencioso: si falla, el botón sigue visible y el trader puede reintentar.
    } finally {
      setAcknowledging(false);
    }
  };

  if (!ack.exists) return null;

  return (
    <button type="button" className="primary-btn btn-sm pre-session-accept-btn" onClick={handleAccept} disabled={acknowledging}>
      {acknowledging ? 'Guardando…' : 'He leído el briefing y acepto el plan de acción de hoy →'}
    </button>
  );
}

/** Tarjeta de selección única — texto completo legible, no un chip chico. */
function OptionCard({ option, active, onClick }: { option: string; active: boolean; onClick: () => void }) {
  return (
    <button type="button" className={`check-in-option-card ${active ? 'active' : ''}`} onClick={onClick}>
      <span className="check-in-option-radio" aria-hidden="true" />
      <span>{option}</span>
    </button>
  );
}

function PreSessionCheckInModal({ onClose, initialStep = 'quiz' }: { onClose: () => void; initialStep?: Step }) {
  const { user } = useAuth();
  const { bump } = useRefresh();

  const [step, setStep] = useState<Step>(initialStep);
  const [quizStep, setQuizStep] = useState(0);

  const [feeling, setFeeling] = useState<string | null>(null);
  const [whyTrading, setWhyTrading] = useState<string | null>(null);
  const [mindset, setMindset] = useState<string | null>(null);
  const [sleepHours, setSleepHours] = useState('');
  const [caffeineMg, setCaffeineMg] = useState('');
  const [exercised, setExercised] = useState<boolean | null>(null);
  const [intentions, setIntentions] = useState<string[]>([]);
  const [lifeStressors, setLifeStressors] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleIntention = (option: string) => {
    setIntentions((current) => (current.includes(option) ? current.filter((item) => item !== option) : [...current, option]));
  };

  const canAdvanceQuizStep =
    (quizStep === 0 && feeling !== null) ||
    (quizStep === 1 && whyTrading !== null) ||
    (quizStep === 2 && mindset !== null) ||
    quizStep === 3;

  const goBack = () => setQuizStep((current) => Math.max(current - 1, 0));

  const handleSubmitQuiz = async () => {
    if (!user || !feeling || !whyTrading || !mindset || saving) return;
    setSaving(true);
    setError(null);
    try {
      const input: PreSessionResponseInput = {
        feeling,
        mindset,
        why_trading: whyTrading,
        sleep_hours: sleepHours.trim() ? Number(sleepHours) : null,
        caffeine_mg: caffeineMg.trim() ? Number(caffeineMg) : null,
        exercised,
        intentions,
        life_stressors: lifeStressors.trim() || null,
      };
      await savePreSessionResponse(user.id, input);
      setStep('briefing');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar tu check-in.');
    } finally {
      setSaving(false);
    }
  };

  const goNextQuizStep = () => {
    if (quizStep < QUIZ_STEP_COUNT - 1) {
      setQuizStep((current) => current + 1);
      return;
    }
    handleSubmitQuiz();
  };

  const handleBriefingAccepted = () => {
    bump();
    onClose();
  };

  return (
    <div className="pre-session-backdrop">
      <div className="pre-session-panel">
        <div className="pre-session-eyebrow-row">
          <OmegaMark size={28} />
          <span className="eyebrow">{step === 'quiz' ? 'Check-in pre-sesión' : 'Briefing Pre-Sesión'}</span>
          {step === 'quiz' && (
            <button type="button" className="pre-session-close-btn" onClick={onClose} aria-label="Cerrar">
              ✕
            </button>
          )}
        </div>

        <div className="pre-session-scroll-area">
        {step === 'quiz' ? (
          <div className="check-in-quiz">
            <div className="check-in-progress-bar" role="progressbar" aria-valuenow={quizStep + 1} aria-valuemin={1} aria-valuemax={QUIZ_STEP_COUNT}>
              <div className="check-in-progress-fill" style={{ width: `${((quizStep + 1) / QUIZ_STEP_COUNT) * 100}%` }} />
            </div>
            <span className="check-in-progress-label">
              Paso {quizStep + 1} de {QUIZ_STEP_COUNT}
            </span>

            {quizStep === 0 && (
              <div className="check-in-step">
                <h2>¿Cómo te sentís ahora mismo?</h2>
                <div className="check-in-option-list">
                  {FEELING_OPTIONS.map((option) => (
                    <OptionCard key={option} option={option} active={feeling === option} onClick={() => setFeeling(option)} />
                  ))}
                </div>
              </div>
            )}

            {quizStep === 1 && (
              <div className="check-in-step">
                <h2>¿Por qué estás sentado frente a las gráficas hoy?</h2>
                <div className="check-in-option-list">
                  {WHY_TRADING_OPTIONS.map((option) => (
                    <OptionCard key={option} option={option} active={whyTrading === option} onClick={() => setWhyTrading(option)} />
                  ))}
                </div>
              </div>
            )}

            {quizStep === 2 && (
              <div className="check-in-step">
                <h2>¿Con qué mentalidad llegás hoy?</h2>
                <div className="check-in-option-list">
                  {MINDSET_OPTIONS.map((option) => (
                    <OptionCard key={option} option={option} active={mindset === option} onClick={() => setMindset(option)} />
                  ))}
                </div>
              </div>
            )}

            {quizStep === 3 && (
              <div className="check-in-step">
                <h2>Intenciones y estado físico</h2>
                <p className="hint-text">Todo esto es opcional — completá lo que te sirva.</p>

                <div className="pre-session-field">
                  <label>Intenciones para hoy</label>
                  <div className="pre-session-chip-row wrap">
                    {INTENTION_OPTIONS.map((option) => (
                      <button
                        key={option}
                        type="button"
                        className={`pill-btn gold small ${intentions.includes(option) ? 'active' : ''}`}
                        onClick={() => toggleIntention(option)}
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="pre-session-field-row">
                  <div className="pre-session-field">
                    <label>Horas de sueño</label>
                    <input type="number" min={0} max={24} value={sleepHours} onChange={(event) => setSleepHours(event.target.value)} />
                  </div>
                  <div className="pre-session-field">
                    <label>Cafeína en mg</label>
                    <input type="number" min={0} value={caffeineMg} onChange={(event) => setCaffeineMg(event.target.value)} />
                  </div>
                  <div className="pre-session-field">
                    <label>¿Hiciste ejercicio hoy?</label>
                    <div className="pre-session-chip-row">
                      <button
                        type="button"
                        className={`pill-btn gold small ${exercised === true ? 'active' : ''}`}
                        onClick={() => setExercised(true)}
                      >
                        Sí
                      </button>
                      <button
                        type="button"
                        className={`pill-btn gold small ${exercised === false ? 'active' : ''}`}
                        onClick={() => setExercised(false)}
                      >
                        No
                      </button>
                    </div>
                  </div>
                </div>

                <div className="pre-session-field">
                  <label>¿Algo en tu vida personal que pueda influir hoy?</label>
                  <textarea
                    value={lifeStressors}
                    onChange={(event) => setLifeStressors(event.target.value)}
                    placeholder="Opcional — solo si sentís que puede afectar tu operativa."
                    rows={2}
                  />
                </div>
              </div>
            )}

            {error && <p className="omega-chat-error">{error}</p>}
          </div>
        ) : (
          <div className="pre-session-briefing-step">
            <BriefingPreSesion />
          </div>
        )}
        </div>

        <div className="pre-session-footer">
          {step === 'quiz' ? (
            <>
              {quizStep > 0 ? (
                <button type="button" className="ghost-btn btn-sm" onClick={goBack}>
                  Atrás
                </button>
              ) : (
                <button type="button" className="ghost-btn btn-sm" onClick={onClose}>
                  Cancelar
                </button>
              )}
              <button type="button" className="primary-btn btn-sm" onClick={goNextQuizStep} disabled={!canAdvanceQuizStep || saving}>
                {saving ? 'Guardando…' : quizStep < QUIZ_STEP_COUNT - 1 ? 'Siguiente →' : 'Continuar al Briefing →'}
              </button>
            </>
          ) : (
            <PreSessionBriefingGate onAccepted={handleBriefingAccepted} />
          )}
        </div>
      </div>
    </div>
  );
}

export default PreSessionCheckInModal;
