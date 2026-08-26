import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { useOmega } from '../contexts/OmegaContext';
import type { OmegaEffects } from '../hooks/useOmegaAgent';
import OmegaMark from './OmegaMark';

export function EffectsSummary({ effects }: { effects: OmegaEffects }) {
  const chips: { key: string; label: string; kind: 'positive' | 'negative' | 'mission' | 'streak' }[] = [];

  if (effects.sessionVerdict) {
    chips.push({
      key: 'verdict',
      label: `Auditoría registrada${effects.sessionVerdict.ataraxia_score !== null ? `: Ataraxia ${effects.sessionVerdict.ataraxia_score}%` : ''}`,
      kind: 'streak',
    });
  }
  if (effects.virtusDelta !== 0) {
    chips.push({
      key: 'virtus',
      label: `${effects.virtusDelta > 0 ? '+' : ''}${effects.virtusDelta} Virtus`,
      kind: effects.virtusDelta > 0 ? 'positive' : 'negative',
    });
  }
  effects.missionsAssigned.forEach((m, i) =>
    chips.push({ key: `mission-${i}`, label: `Misión: ${m.title} (+${m.reward_xp})`, kind: 'mission' }),
  );
  effects.streakValidations.forEach((s, i) =>
    chips.push({ key: `streak-${i}`, label: `Racha validada (+${s.bonus_xp})`, kind: 'streak' }),
  );
  effects.goalUpdates.forEach((g, i) =>
    chips.push({
      key: `goal-${i}`,
      label: `Meta: ${g.goalText} ${g.delta > 0 ? '+' : ''}${g.delta}%`,
      kind: g.delta >= 0 ? 'positive' : 'negative',
    }),
  );
  effects.missionProgressUpdates.forEach((m, i) =>
    chips.push({
      key: `mission-progress-${i}`,
      label: `Progreso: ${m.missionTitle} → ${m.newPct}%`,
      kind: 'mission',
    }),
  );

  if (chips.length === 0) return null;

  return (
    <div className="omega-chat-effects">
      {chips.map((chip) => (
        <span key={chip.key} className={`omega-effect-chip ${chip.kind}`}>
          {chip.label}
        </span>
      ))}
    </div>
  );
}

function OmegaChat() {
  const { messages, sending, error, lastEffects, sendMessage, evaluateSession, uiAlerts } = useOmega();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, sending]);

  const handleSend = () => {
    const text = input.trim();
    if (!text || sending) return;
    setInput('');
    sendMessage(text);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  };

  return (
    <>
      <button
        type="button"
        className="omega-launcher"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? 'Cerrar a Omega' : 'Abrir a Omega'}
      >
        <OmegaMark size={44} />
        {uiAlerts.length > 0 && <span className="omega-launcher-badge" aria-hidden="true" />}
      </button>

      {open && (
        <div className="omega-chat-panel" role="dialog" aria-label="Chat con Omega">
          <div className="omega-chat-header">
            <OmegaMark size={34} />
            <div className="omega-chat-header-title">
              <h3>Omega</h3>
              <span>Coach de disciplina y ejecución</span>
            </div>
            <button type="button" className="icon-btn" aria-label="Cerrar" onClick={() => setOpen(false)}>
              ✕
            </button>
          </div>

          <div className="omega-chat-quick-actions">
            <button
              type="button"
              className="ghost-btn btn-sm"
              disabled={sending}
              onClick={() => evaluateSession()}
            >
              Evaluar mi sesión de hoy
            </button>
          </div>

          <div className="omega-chat-messages">
            {messages.length === 0 && (
              <p className="omega-chat-empty">
                Cuéntale a Omega cómo fue tu sesión, o pídele que evalúe tu día — no da señales ni predicciones,
                solo juzga tu disciplina y tu proceso.
              </p>
            )}
            {messages.map((message, index) => (
              <div key={index} className={`omega-chat-bubble ${message.role}`}>
                {message.content}
              </div>
            ))}
            {sending && <div className="omega-chat-typing">Omega está pensando…</div>}
            <div ref={messagesEndRef} />
          </div>

          {lastEffects && <EffectsSummary effects={lastEffects} />}
          {error && <p className="omega-chat-error">{error}</p>}

          <div className="omega-chat-input-row">
            <textarea
              rows={1}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Escríbele a Omega…"
              disabled={sending}
            />
            <button type="button" className="primary-btn btn-sm" onClick={handleSend} disabled={sending || !input.trim()}>
              Enviar
            </button>
          </div>
        </div>
      )}
    </>
  );
}

export default OmegaChat;
