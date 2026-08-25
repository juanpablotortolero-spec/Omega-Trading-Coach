import type { ExecutionWindow, QuizState } from './api';

// "Ataraxia" — la calma estoica, ausencia de perturbación mental — es el
// nombre temático de este índice de disciplina operativa, coherente con el
// resto del sistema Virtus (Logos/Ethos/Praxis/Kairos/Omega).
export const ATARAXIA_LABEL = 'Ataraxia';

// Degradado "psicológico" reutilizado por la barra Y el gráfico de
// Estadísticas — misma paleta, mismos cortes, para que ambos se vean
// como una sola identidad: Rojo Terracota (Miedo/Indisciplina) → Bronce
// Forjado (Atlas) → Zafiro Estoico (Ataraxia), con transiciones amplias
// y difuminadas en vez de cortes duros.
export const ARETE_GRADIENT_STOPS: [number, [number, number, number]][] = [
  [0, [139, 58, 54]], // #8B3A36 Rojo Terracota
  [25, [139, 58, 54]],
  [45, [138, 107, 78]], // #8A6B4E Bronce Forjado
  [65, [138, 107, 78]],
  [85, [74, 107, 130]], // #4A6B82 Zafiro Estoico
  [100, [74, 107, 130]],
];

export function scoreToColor(score: number): string {
  const clamped = Math.min(100, Math.max(0, score));
  for (let i = 0; i < ARETE_GRADIENT_STOPS.length - 1; i += 1) {
    const [p0, c0] = ARETE_GRADIENT_STOPS[i];
    const [p1, c1] = ARETE_GRADIENT_STOPS[i + 1];
    if (clamped >= p0 && clamped <= p1) {
      const t = (clamped - p0) / (p1 - p0);
      const r = Math.round(c0[0] + (c1[0] - c0[0]) * t);
      const g = Math.round(c0[1] + (c1[1] - c0[1]) * t);
      const b = Math.round(c0[2] + (c1[2] - c0[2]) * t);
      return `rgb(${r}, ${g}, ${b})`;
    }
  }
  const [, last] = ARETE_GRADIENT_STOPS[ARETE_GRADIENT_STOPS.length - 1];
  return `rgb(${last.join(', ')})`;
}

export const constructiveEmotions = new Set(['Calma', 'Disciplina', 'Seguridad', 'Paciencia']);

export type DisciplineOperationInput = {
  model: string | null;
  session: ExecutionWindow | null;
  brokePlan: boolean;
};

export type DisciplineScoreInput = {
  directriz: string | null;
  quiz: QuizState;
  psychologyEmotions: string[];
  operations: DisciplineOperationInput[];
  maxTradesPerSession: string | null;
};

export type DisciplineScoreResult = {
  score: number | null;
  positives: string[];
  negatives: string[];
};

type Check = {
  label: string;
  negLabel: string;
  weight: number;
  applicable: boolean;
  passed: boolean;
};

// Solo se puntúa lo que el trader realmente respondió/registró ese día — si
// un dato no fue capturado, el check se omite en vez de fabricar un resultado.
export function computeDisciplineScore(input: DisciplineScoreInput): DisciplineScoreResult {
  const hasOps = input.operations.length > 0;
  const bias = input.quiz.bias_correct?.answer ?? null;
  const narrative = input.quiz.narrative_respected?.answer ?? null;
  const setupParams = input.quiz.setup_params?.answer ?? null;
  const risk = input.quiz.risk_respected?.answer ?? null;
  const maxTrades = input.maxTradesPerSession ? Number(input.maxTradesPerSession) : NaN;

  const constructiveCount = input.psychologyEmotions.filter((emotion) => constructiveEmotions.has(emotion)).length;
  const destructiveCount = input.psychologyEmotions.length - constructiveCount;

  const checks: Check[] = [
    {
      label: 'Completaste tu journal pre-sesión',
      negLabel: 'No completaste tu journal pre-sesión',
      weight: 10,
      applicable: true,
      passed: Boolean(input.directriz && input.directriz.trim()),
    },
    {
      label: 'Ejecutaste con un modelo/setup definido en tu plan',
      negLabel: 'Ejecutaste sin un modelo/setup definido en tu plan',
      weight: 10,
      applicable: hasOps,
      passed: hasOps && input.operations.every((op) => Boolean(op.model && op.model.trim())),
    },
    {
      label: 'Tu bias del día fue correcto',
      negLabel: 'Tu bias del día no fue correcto',
      weight: 15,
      applicable: bias === 'Sí' || bias === 'No',
      passed: bias === 'Sí',
    },
    {
      label: 'Respetaste tu narrativa pre-sesión',
      negLabel: 'No respetaste tu narrativa pre-sesión',
      weight: 15,
      applicable: narrative === 'Sí' || narrative === 'No',
      passed: narrative === 'Sí',
    },
    {
      label: 'El setup ejecutado cumplió los parámetros de tu plan',
      negLabel: 'El setup ejecutado no cumplió los parámetros de tu plan',
      weight: 15,
      applicable: setupParams === 'Sí' || setupParams === 'No',
      passed: setupParams === 'Sí',
    },
    {
      label: 'Respetaste tu manejo de riesgo',
      negLabel: 'No respetaste tu manejo de riesgo',
      weight: 15,
      applicable: risk === 'Sí' || risk === 'No',
      passed: risk === 'Sí',
    },
    {
      label: 'Te mantuviste dentro del máximo de operaciones de tu plan',
      negLabel: 'Excediste el máximo de operaciones permitidas en tu plan',
      weight: 10,
      applicable: hasOps && !Number.isNaN(maxTrades) && maxTrades > 0,
      passed: input.operations.length <= maxTrades,
    },
    {
      label: 'Operaste dentro de tus ventanas de sesión definidas',
      negLabel: 'Ejecutaste fuera de tu ventana de sesión',
      weight: 10,
      applicable: hasOps,
      passed: hasOps && input.operations.every((op) => op.session !== 'outside_window'),
    },
    {
      label: 'Ninguna operación incumplió tu plan',
      negLabel: 'Marcaste operaciones que incumplieron tu plan',
      weight: 15,
      applicable: hasOps,
      passed: hasOps && input.operations.every((op) => !op.brokePlan),
    },
    {
      label: 'Tu estado emocional predominante fue constructivo',
      negLabel: 'Predominaron emociones destructivas durante tu operativa (ansiedad, FOMO, venganza, codicia…)',
      weight: 10,
      applicable: input.psychologyEmotions.length > 0,
      passed: constructiveCount >= destructiveCount,
    },
  ];

  const applicableChecks = checks.filter((check) => check.applicable);
  const possible = applicableChecks.reduce((sum, check) => sum + check.weight, 0);

  if (possible === 0) {
    return { score: null, positives: [], negatives: [] };
  }

  const earned = applicableChecks.filter((check) => check.passed).reduce((sum, check) => sum + check.weight, 0);
  const score = Math.round((earned / possible) * 100);

  return {
    score,
    positives: applicableChecks.filter((check) => check.passed).map((check) => check.label),
    negatives: applicableChecks.filter((check) => !check.passed).map((check) => check.negLabel),
  };
}

export type DailyDisciplineScore = { date: string; score: number; negatives: string[] };

// Reduce un historial completo de journals + operaciones a un puntaje Arete
// por día — reutilizado tanto por el total acumulado de Inicio como por el
// gráfico/promedio filtrado de Estadísticas, para no duplicar la lógica.
export function computeDisciplineTimeline(
  entriesByDate: Record<string, { directriz: string | null; quiz: QuizState; psychologyEmotions: string[] }>,
  opsByDate: Map<string, DisciplineOperationInput[]>,
  maxTradesPerSession: string | null,
): DailyDisciplineScore[] {
  return Object.keys(entriesByDate)
    .sort()
    .map((date) => {
      const input = entriesByDate[date];
      const result = computeDisciplineScore({
        directriz: input.directriz,
        quiz: input.quiz,
        psychologyEmotions: input.psychologyEmotions,
        operations: opsByDate.get(date) ?? [],
        maxTradesPerSession,
      });
      return result.score !== null ? { date, score: result.score, negatives: result.negatives } : null;
    })
    .filter((item): item is DailyDisciplineScore => item !== null);
}

// "Multiplicador de Flujo" — 3 sesiones consecutivas en Zona Zafiro
// (≥75%, incluyendo hoy) activan un estado de racha. `priorTimeline` debe
// venir ya filtrado a fechas ANTERIORES a la sesión de hoy — esta función
// solo mira las 2 sesiones registradas más recientes antes de hoy.
export function hasAtaraxiaFlowStreak(priorTimeline: DailyDisciplineScore[], todayScore: number | null): boolean {
  if (todayScore === null || todayScore < 75) return false;
  const lastTwo = [...priorTimeline].sort((a, b) => a.date.localeCompare(b.date)).slice(-2);
  if (lastTwo.length < 2) return false;
  return lastTwo.every((day) => day.score >= 75);
}
