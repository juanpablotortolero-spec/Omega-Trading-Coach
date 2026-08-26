export type Medal = {
  level: string;
  name: string;
  range: string;
  accent: string;
  minPoints: number;
};

export const stageBadges: Medal[] = [
  { level: 'LOGOS', name: 'La Lógica y la Base', range: '0 – 2,500 pts', accent: 'gold', minPoints: 0 },
  { level: 'ETHOS', name: 'El Carácter y la Disciplina', range: '2,500 – 7,500 pts', accent: 'bronze', minPoints: 2500 },
  { level: 'PRAXIS', name: 'La Ejecución', range: '7,500 – 17,500 pts', accent: 'gold', minPoints: 7500 },
  { level: 'KAIROS', name: 'El Momento Oportuno', range: '17,500 – 37,500 pts', accent: 'bronze', minPoints: 17500 },
  { level: 'OMEGA', name: 'La Culminación Estoica', range: '37,500+ pts', accent: 'gold', minPoints: 37500 },
];

export function currentStage(totalPoints: number): Medal {
  return [...stageBadges].reverse().find((badge) => totalPoints >= badge.minPoints) ?? stageBadges[0];
}

export function stageProgressPct(totalPoints: number): number {
  const stage = currentStage(totalPoints);
  const nextStage = stageBadges[stageBadges.indexOf(stage) + 1];
  if (!nextStage) return 100;

  const span = nextStage.minPoints - stage.minPoints;
  const progress = totalPoints - stage.minPoints;
  return Math.min(100, Math.max(0, Math.round((progress / span) * 100)));
}

// "Carga del Rango" — a mayor rango, mayor exigencia: las penalizaciones de
// Virtus pesan más para reflejar el estándar institucional de cada nivel.
// 5 escalones (no 3) para que cada rango pese más que el anterior, sin
// saltos — el mismo error duele progresivamente más a medida que subís.
const RANK_PENALTY_MULTIPLIERS: Record<string, number> = {
  LOGOS: 1.0,
  ETHOS: 1.1,
  PRAXIS: 1.25,
  KAIROS: 1.45,
  OMEGA: 1.7,
};

export function rankPenaltyMultiplier(level: string): number {
  return RANK_PENALTY_MULTIPLIERS[level] ?? 1;
}
