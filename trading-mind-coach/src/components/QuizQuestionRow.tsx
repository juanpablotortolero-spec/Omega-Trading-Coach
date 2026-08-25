import { useState } from 'react';
import { autoGrow } from '../lib/autoGrow';
import type { QuizAnswer } from '../lib/api';

function QuizQuestionRow({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: string[];
  value: QuizAnswer;
  onChange: (next: QuizAnswer) => void;
}) {
  const [noteOpen, setNoteOpen] = useState(Boolean(value.note));

  return (
    <div className="pill-field quiz-row">
      <span className="eyebrow">{label}</span>
      <div className="pill-row">
        {options.map((option) => (
          <button
            key={option}
            type="button"
            className={`pill-btn gold small ${value.answer === option ? 'active' : ''}`}
            onClick={() => onChange({ ...value, answer: option })}
          >
            {option}
          </button>
        ))}
      </div>

      {noteOpen ? (
        <textarea
          onInput={autoGrow}
          value={value.note}
          onChange={(event) => onChange({ ...value, note: event.target.value })}
          placeholder="Nota opcional…"
          rows={2}
        />
      ) : (
        <button type="button" className="quiz-note-toggle" onClick={() => setNoteOpen(true)}>
          + Agregar nota
        </button>
      )}
    </div>
  );
}

export default QuizQuestionRow;
