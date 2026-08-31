import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { submitMissionReflection, type AiMission } from '../lib/api';

/**
 * Tarjeta de misión compartida entre el Dashboard y el Tab Objetivos de
 * Omega Coach (antes duplicada en ambos) — agrega el espacio de respuesta
 * interactiva para misiones de autorreflexión. Guardar la respuesta NO
 * completa la misión: Omega la lee en el próximo contacto y decide, con
 * update_mission_progress, si ameritó avance real.
 */
function MissionCard({ mission, showCompletedState = false }: { mission: AiMission; showCompletedState?: boolean }) {
  const { user } = useAuth();
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [savedLocally, setSavedLocally] = useState(false);

  const handleSave = async () => {
    if (!user || !draft.trim() || saving) return;
    setSaving(true);
    try {
      await submitMissionReflection(user.id, mission.id, draft.trim());
      setSavedLocally(true);
    } finally {
      setSaving(false);
    }
  };

  const answered = Boolean(mission.reflection_answer) || savedLocally;
  const answerText = mission.reflection_answer ?? draft;

  return (
    <div className={`omega-mission-card ${showCompletedState && mission.completed ? 'completed' : ''}`}>
      <div className="omega-mission-copy">
        <strong>{mission.title}</strong>
        <p className="hint-text">{mission.description}</p>
        <div className="omega-mission-meta">
          <span className="nav-soon">{mission.frequency}</span>
          <span className="hint-text">+{mission.reward_xp} XP</span>
        </div>
        <div className="gauge-wrap omega-mission-progress">
          <span className="gauge-fill" style={{ width: `${mission.progress_pct}%` }} />
        </div>
        <p className="hint-text">
          {mission.completed
            ? 'Verificada por Omega — XP acreditado.'
            : `Omega verifica tu progreso real: ${mission.progress_pct}%`}
        </p>

        {mission.requires_reflection &&
          !mission.completed &&
          (answered ? (
            <div className="mission-reflection-answer">
              <span className="eyebrow">Tu respuesta</span>
              <p>{answerText}</p>
            </div>
          ) : (
            <div className="mission-reflection-input">
              <textarea
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder="Escribí tu respuesta acá…"
                rows={3}
              />
              <button type="button" className="ghost-btn btn-sm" onClick={handleSave} disabled={saving || !draft.trim()}>
                {saving ? 'Guardando…' : 'Guardar respuesta'}
              </button>
            </div>
          ))}
      </div>
    </div>
  );
}

export default MissionCard;
