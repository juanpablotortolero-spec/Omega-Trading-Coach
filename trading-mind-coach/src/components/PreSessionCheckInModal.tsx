import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useOmega } from '../contexts/OmegaContext';
import { useRefresh } from '../contexts/RefreshContext';
import { acknowledgeBriefing, getTodayBriefingAckStatus, savePreSessionResponse, type PreSessionResponseInput } from '../lib/api';
import { localIsoDate } from '../lib/calendar';
import BriefingPreSesion from './BriefingPreSesion';
import OmegaMark from './OmegaMark';

type Step = 'quiz' | 'briefing';

const FEELING_OPTIONS = ['Enfocado', 'Motivado', 'Neutral', 'Ansioso', 'Cansado', 'Irritable'];

const INTENTION_OPTIONS = [
  'Respetar mi plan al pie de la letra',
  'No promediar en contra',
  'Salir apenas rompa una regla',
  'Operar solo mi setup A+',
  'Parar después de 2 pérdidas seguidas',
];

/**
 * Gate de aceptación del briefing — vive DENTRO del modal (a diferencia de
 * antes, que estaba en OmegaDashboard) porque ahora el trader tiene que
 * leerlo y aceptarlo acá para que MainLayout destrabe "Nuevo journal" (ver
 * briefingAcknowledgedToday en MainLayout.tsx, misma tabla omega_briefings).
 */
function PreSessionBriefingGate({ onAccepted }: { onAccepted: () => void }) {
  const { user } = useAuth();
  const { sending } = useOmega();
  const todayIso = localIsoDate(new Date());

  const [ack, setAck] = useState<{ exists: boolean; acknowledged: boolean }>({ exists: false, acknowledged: false });
  const [acknowledging, setAcknowledging] = useState(false);

  useEffect(() => {
    if (!user || sending) return;
    let cancelled = false;

    getTodayBriefingAckStatus(user.id, todayIso).then((status) => {
      if (!cancelled) setAck(status);
    });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, sending]);

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

function PreSessionCheckInModal({ onClose, initialStep = 'quiz' }: { onClose: () => void; initialStep?: Step }) {
  const { user } = useAuth();
  const { bump } = useRefresh();

  const [step, setStep] = useState<Step>(initialStep);
  const [feeling, setFeeling] = useState<string | null>(null);
  const [mindset, setMindset] = useState('');
  const [whyTrading, setWhyTrading] = useState('');
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

  const isValid = Boolean(feeling) && mindset.trim().length > 0 && whyTrading.trim().length > 0;

  const handleSubmitQuiz = async () => {
    if (!user || !isValid || saving) return;
    setSaving(true);
    setError(null);
    try {
      const input: PreSessionResponseInput = {
        feeling: feeling!,
        mindset: mindset.trim(),
        why_trading: whyTrading.trim(),
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

        {step === 'quiz' ? (
          <div className="pre-session-quiz">
            <h2>Antes de operar, un momento con vos mismo.</h2>

            <div className="pre-session-field">
              <label>¿Cómo te sentís ahora mismo?</label>
              <div className="pre-session-chip-row">
                {FEELING_OPTIONS.map((option) => (
                  <button
                    key={option}
                    type="button"
                    className={`pill-btn gold small ${feeling === option ? 'active' : ''}`}
                    onClick={() => setFeeling(option)}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>

            <div className="pre-session-field">
              <label>¿Con qué mentalidad llegás hoy?</label>
              <textarea
                value={mindset}
                onChange={(event) => setMindset(event.target.value)}
                placeholder="Ej: vengo a ejecutar mi plan, no a recuperar nada de ayer."
                rows={2}
              />
            </div>

            <div className="pre-session-field">
              <label>¿Por qué vas a operar hoy?</label>
              <textarea
                value={whyTrading}
                onChange={(event) => setWhyTrading(event.target.value)}
                placeholder="Una razón real, no una excusa."
                rows={2}
              />
            </div>

            <div className="pre-session-field-row">
              <div className="pre-session-field">
                <label>Horas de sueño (opcional)</label>
                <input
                  type="number"
                  min={0}
                  max={24}
                  value={sleepHours}
                  onChange={(event) => setSleepHours(event.target.value)}
                />
              </div>
              <div className="pre-session-field">
                <label>Cafeína en mg (opcional)</label>
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
              <label>Intenciones para hoy (opcional — elegí las que apliquen)</label>
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

            <div className="pre-session-field">
              <label>¿Algo en tu vida personal que pueda influir hoy? (opcional)</label>
              <textarea
                value={lifeStressors}
                onChange={(event) => setLifeStressors(event.target.value)}
                placeholder="Opcional — solo si sentís que puede afectar tu operativa."
                rows={2}
              />
            </div>

            {error && <p className="omega-chat-error">{error}</p>}

            <div className="pre-session-footer">
              <button type="button" className="ghost-btn btn-sm" onClick={onClose}>
                Cancelar
              </button>
              <button type="button" className="primary-btn btn-sm" onClick={handleSubmitQuiz} disabled={!isValid || saving}>
                {saving ? 'Guardando…' : 'Continuar al Briefing →'}
              </button>
            </div>
          </div>
        ) : (
          <div className="pre-session-briefing-step">
            <BriefingPreSesion />
            <PreSessionBriefingGate onAccepted={handleBriefingAccepted} />
          </div>
        )}
      </div>
    </div>
  );
}

export default PreSessionCheckInModal;
