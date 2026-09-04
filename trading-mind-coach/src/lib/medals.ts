export type MedalTierName = 'Bronce' | 'Plata' | 'Oro' | 'Platino' | 'Diamante' | 'Rubí' | 'Esmeralda';

/**
 * Repeticiones necesarias DESDE la medalla anterior (no acumulado) — el
 * contador se reinicia cada vez que se sube de medalla, así que la N-ésima
 * medalla siempre exige lo mismo sin importar cuántas veces ya se reinició.
 */
export const MEDAL_TIER_STEPS: { name: MedalTierName; needed: number }[] = [
  { name: 'Bronce', needed: 1 },
  { name: 'Plata', needed: 15 },
  { name: 'Oro', needed: 50 },
  { name: 'Platino', needed: 100 },
  { name: 'Diamante', needed: 250 },
  { name: 'Rubí', needed: 500 },
  { name: 'Esmeralda', needed: 1000 },
];

/** XP Virtus que otorga desbloquear cada escalón — mientras más alta la medalla, más XP. */
export const MEDAL_TIER_XP: Record<MedalTierName, number> = {
  Bronce: 20,
  Plata: 50,
  Oro: 100,
  Platino: 200,
  Diamante: 400,
  Rubí: 800,
  Esmeralda: 1500,
};

export type MedalProgress = {
  /** -1 si todavía no se alcanzó ni Bronce. */
  tierIndex: number;
  tierName: MedalTierName | null;
  /** Repeticiones acumuladas dentro del tramo actual (reiniciado tras la última medalla). */
  countInTier: number;
  /** Repeticiones que faltan para la siguiente medalla, o null si ya se alcanzó Esmeralda. */
  neededForNext: number | null;
  nextTierName: MedalTierName | null;
  maxed: boolean;
};

export function getMedalProgress(totalCompletions: number): MedalProgress {
  let remaining = Math.max(0, totalCompletions);
  let tierIndex = -1;

  for (let i = 0; i < MEDAL_TIER_STEPS.length; i += 1) {
    const step = MEDAL_TIER_STEPS[i];
    if (remaining >= step.needed) {
      remaining -= step.needed;
      tierIndex = i;
    } else {
      return {
        tierIndex,
        tierName: tierIndex >= 0 ? MEDAL_TIER_STEPS[tierIndex].name : null,
        countInTier: remaining,
        neededForNext: step.needed,
        nextTierName: step.name,
        maxed: false,
      };
    }
  }

  return {
    tierIndex,
    tierName: MEDAL_TIER_STEPS[tierIndex].name,
    countInTier: remaining,
    neededForNext: null,
    nextTierName: null,
    maxed: true,
  };
}
