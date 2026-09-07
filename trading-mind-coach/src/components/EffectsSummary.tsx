import type { OmegaEffects } from '../hooks/useOmegaAgent';

/** Resumen visual de los efectos que Omega acaba de aplicar (XP, misiones, metas, rachas). */
function EffectsSummary({ effects }: { effects: OmegaEffects }) {
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
  effects.psychGrowth.forEach((g, i) =>
    chips.push({
      key: `psych-${i}`,
      label: g.category === 'correccion' ? 'Corrección de errores' : 'Fortaleza sostenida',
      kind: 'positive',
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

export default EffectsSummary;
