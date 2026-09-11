import { useState } from 'react';
import { autoGrow } from '../lib/autoGrow';
import {
  postMarketQuizQuestions,
  postSessionReflectionQuestions,
  psychologyEmotions,
  type PostSessionExtra,
  type QuizState,
} from '../lib/api';
import OmegaMark from './OmegaMark';
import QuizQuestionRow from './QuizQuestionRow';

type Step =
  | { kind: 'quiz'; index: number }
  | { kind: 'emotions' }
  | { kind: 'notes' }
  | { kind: 'reflection'; index: number; floating: boolean }
  | { kind: 'review' };

function buildSteps(): Step[] {
  const steps: Step[] = postMarketQuizQuestions.map((_, index) => ({ kind: 'quiz', index }));
  steps.push({ kind: 'emotions' }, { kind: 'notes' });
  postSessionReflectionQuestions.forEach((_, index) => {
    steps.push({ kind: 'reflection', index, floating: index === postSessionReflectionQuestions.length - 1 });
  });
  steps.push({ kind: 'review' });
  return steps;
}

const STEPS = buildSteps();

type Props = {
  quiz: QuizState;
  onQuizChange: (next: QuizState) => void;
  emotions: string[];
  onToggleEmotion: (emotion: string) => void;
  extraNotes: string;
  onExtraNotesChange: (value: string) => void;
  reflection: PostSessionExtra;
  onReflectionChange: (key: keyof PostSessionExtra, value: string) => void;
  ataraxiaScore: number | null;
  readOnly: boolean;
  onClose: () => void;
};

/**
 * "Subpestaña fluida" del Quiz Post-Sesión — una pregunta por pantalla, en
 * vez de la lista larga que tenía antes el bloque "Quiz Post-Mercado" (ver
 * JournalEntry.tsx). Escribe directo en custom_fields.quiz/psychology_emotions/
 * quiz_extra_notes/post_session_extra — la MISMA fuente que ya alimenta
 * computeDisciplineScore (Ataraxia) y computeVirtusEventsV2 (Virtus), sin
 * ningún cambio en esos cálculos. En modo readOnly (journal ya sellado) deja
 * navegar libremente entre pasos para revisar, pero deshabilita cada control.
 */
function PostSessionQuizModal({
  quiz,
  onQuizChange,
  emotions,
  onToggleEmotion,
  extraNotes,
  onExtraNotesChange,
  reflection,
  onReflectionChange,
  ataraxiaScore,
  readOnly,
  onClose,
}: Props) {
  const [stepIndex, setStepIndex] = useState(0);
  const step = STEPS[stepIndex];
  const isLast = stepIndex === STEPS.length - 1;

  const canAdvance = (() => {
    if (readOnly) return true;
    if (step.kind === 'quiz') {
      const question = postMarketQuizQuestions[step.index];
      return quiz[question.key]?.answer !== null && quiz[question.key]?.answer !== undefined;
    }
    if (step.kind === 'reflection') {
      const question = postSessionReflectionQuestions[step.index];
      return reflection[question.key] !== null;
    }
    return true;
  })();

  const goNext = () => setStepIndex((current) => Math.min(current + 1, STEPS.length - 1));
  const goBack = () => setStepIndex((current) => Math.max(current - 1, 0));

  return (
    <div className="post-session-quiz-backdrop">
      <div className="post-session-quiz-panel">
        <div className="pre-session-eyebrow-row">
          <OmegaMark size={28} />
          <span className="eyebrow">
            {readOnly ? 'Quiz Post-Sesión — revisión' : `Quiz Post-Sesión — paso ${stepIndex + 1} de ${STEPS.length}`}
          </span>
          <button type="button" className="pre-session-close-btn" onClick={onClose} aria-label="Cerrar">
            ✕
          </button>
        </div>

        <div className="post-session-quiz-body">
          {step.kind === 'quiz' && (
            <QuizQuestionRow
              label={postMarketQuizQuestions[step.index].label}
              options={postMarketQuizQuestions[step.index].options}
              value={quiz[postMarketQuizQuestions[step.index].key] ?? { answer: null, note: '' }}
              onChange={(next) => onQuizChange({ ...quiz, [postMarketQuizQuestions[step.index].key]: next })}
              disabled={readOnly}
            />
          )}

          {step.kind === 'emotions' && (
            <div className="pill-field">
              <span className="eyebrow">Emociones predominantes (opcional — elegí las que apliquen)</span>
              <div className="pill-row">
                {psychologyEmotions.map((emotion) => (
                  <button
                    key={emotion}
                    type="button"
                    className={`pill-btn gold small ${emotions.includes(emotion) ? 'active' : ''}`}
                    onClick={() => onToggleEmotion(emotion)}
                    disabled={readOnly}
                  >
                    {emotion}
                  </button>
                ))}
              </div>
            </div>
          )}

          {step.kind === 'notes' && (
            <label className="auth-field">
              <span className="eyebrow">Algo más que quieras agregar (opcional)</span>
              <textarea
                onInput={autoGrow}
                value={extraNotes}
                onChange={(event) => onExtraNotesChange(event.target.value)}
                placeholder="Cualquier otra cosa que quieras recordar de hoy…"
                rows={3}
                disabled={readOnly}
              />
            </label>
          )}

          {step.kind === 'reflection' && (
            <div className={step.floating ? 'post-session-floating-card' : 'pill-field'}>
              <span className="eyebrow">{postSessionReflectionQuestions[step.index].label}</span>
              <div className="pill-row">
                {postSessionReflectionQuestions[step.index].options.map((option) => (
                  <button
                    key={option}
                    type="button"
                    className={`pill-btn gold small ${
                      reflection[postSessionReflectionQuestions[step.index].key] === option ? 'active' : ''
                    }`}
                    onClick={() => onReflectionChange(postSessionReflectionQuestions[step.index].key, option)}
                    disabled={readOnly}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>
          )}

          {step.kind === 'review' && (
            <div className="post-session-review">
              <h2>Listo — así queda tu auditoría de hoy.</h2>
              <p className="hint-text">
                {ataraxiaScore !== null
                  ? `Tu Ataraxia de hoy quedó en ${ataraxiaScore}%.`
                  : 'Tu Ataraxia se termina de calcular con el resto de la sesión.'}
              </p>
              <p className="hint-text">
                {readOnly
                  ? 'Podés navegar hacia atrás para revisar cualquier respuesta.'
                  : 'Cerrá el quiz para poder sellar el registro completo.'}
              </p>
            </div>
          )}
        </div>

        <div className="onboarding-footer">
          <div className="onboarding-dots">
            {STEPS.map((_, index) => (
              <span key={index} className={`onboarding-dot ${index === stepIndex ? 'active' : ''}`} />
            ))}
          </div>
          <div className="onboarding-nav-actions">
            {stepIndex > 0 && (
              <button type="button" className="ghost-btn btn-sm" onClick={goBack}>
                Atrás
              </button>
            )}
            {!isLast ? (
              <button type="button" className="primary-btn btn-sm" onClick={goNext} disabled={!canAdvance}>
                Siguiente
              </button>
            ) : (
              <button type="button" className="primary-btn btn-sm" onClick={onClose}>
                {readOnly ? 'Cerrar' : 'Cerrar Quiz'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default PostSessionQuizModal;
