export type Medal = {
  level: string;
  name: string;
  range: string;
  accent: string;
  minPoints: number;
};

export const stageBadges: Medal[] = [
  { level: 'LOGOS', name: 'La Lógica y la Base', range: '0 – 500 pts', accent: 'gold', minPoints: 0 },
  { level: 'ETHOS', name: 'El Carácter y la Disciplina', range: '501 – 1,500 pts', accent: 'bronze', minPoints: 501 },
  { level: 'PRAXIS', name: 'La Ejecución', range: '1,501 – 3,500 pts', accent: 'gold', minPoints: 1501 },
  { level: 'KAIROS', name: 'El Momento Oportuno', range: '3,501 – 7,000 pts', accent: 'bronze', minPoints: 3501 },
  { level: 'OMEGA', name: 'La Culminación Estoica', range: '7,000+ pts', accent: 'gold', minPoints: 7000 },
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
export function rankPenaltyMultiplier(level: string): number {
  if (level === 'KAIROS' || level === 'OMEGA') return 1.5;
  if (level === 'PRAXIS') return 1.2;
  return 1; // LOGOS, ETHOS
}
