import type { CheckId } from './disciplineScore';

// Catálogo fijo de copy por regla — separado de omegaCoachTemplates.ts (que
// importa funciones de api.ts) específicamente para que api.ts pueda
// importar CHECK_COPY sin crear un ciclo de módulos (api.ts -> omega templates
// -> api.ts). Este archivo no depende de api.ts ni de ningún otro módulo con
// llamadas a Supabase — solo tipos puros de disciplineScore.ts.
export const CHECK_COPY: Record<
  CheckId,
  { weaknessHypothesis: string; weaknessFix: string; missionTask: string; missionXp: number }
> = {
  pre_session_journal: {
    weaknessHypothesis:
      'Entraste a operar sin fijar tu directriz operativa antes — no cruzaste el plan del día contra la realidad del mercado.',
    weaknessFix:
      'Mañana escribís tu directriz operativa ANTES de la primera vela. No importa si es una frase — tiene que existir antes de mirar el gráfico.',
    missionTask: 'Escribí tu directriz operativa completa antes de tu primera operación de mañana.',
    missionXp: 15,
  },
  setup_defined: {
    weaknessHypothesis:
      'Al menos una operación no tenía un setup de tu Manual Operativo asignado — ejecutaste fuera de tu propio marco de referencia.',
    weaknessFix:
      'La próxima operación no se registra si no le asignás uno de tus setups definidos. Sin nombre de setup, no hay entrada.',
    missionTask: 'Antes de tu próxima entrada, nombrá por escrito qué setup de tu plan estás ejecutando.',
    missionXp: 15,
  },
  bias_correct: {
    weaknessHypothesis:
      'Tu lectura direccional del día no se sostuvo — el bias con el que arrancaste no coincidió con lo que hizo el precio.',
    weaknessFix:
      'Mañana, antes de operar, escribí tu bias y el nivel exacto que lo invalida. Si ese nivel se rompe, el bias murió ahí.',
    missionTask: 'Definí por escrito el nivel que invalida tu bias de mañana, antes de la apertura.',
    missionXp: 15,
  },
  narrative_respected: {
    weaknessHypothesis: 'Rompiste tu propia narrativa pre-sesión — el plan decía una cosa y la ejecución hizo otra.',
    weaknessFix: 'Repetí tu narrativa antes de cada entrada. Si la operación no calza con esa frase, no es tu setup, es impulso.',
    missionTask: 'Anotá tu narrativa antes de la sesión y releela antes de cada entrada de mañana.',
    missionXp: 15,
  },
  setup_params_ok: {
    weaknessHypothesis: 'El setup que ejecutaste no cumplía los parámetros que vos mismo definiste — entraste igual.',
    weaknessFix:
      'Antes de la próxima entrada, chequeá cada parámetro del setup contra tu plan uno por uno. Si falta uno solo, no es válido.',
    missionTask: 'Antes de tu próxima entrada, verificá por escrito que el setup cumple TODOS los parámetros de tu plan.',
    missionXp: 20,
  },
  risk_respected: {
    weaknessHypothesis:
      'No respetaste tu manejo de riesgo definido — el tamaño de posición o el stop no siguió tu propia regla.',
    weaknessFix: 'Definí el riesgo en dinero ANTES de entrar. Si no podés calcularlo antes, no operás ese setup.',
    missionTask: 'Calculá y escribí tu riesgo en $ antes de cada entrada de mañana, antes de poner la orden.',
    missionXp: 20,
  },
  max_trades: {
    weaknessHypothesis: 'Excediste el máximo de operaciones que vos mismo fijaste para esta sesión.',
    weaknessFix: 'Al llegar a tu número máximo de operaciones, cerrás la plataforma. No hay "una más".',
    missionTask: 'Contá tus operaciones en vivo mañana y parate en seco al llegar a tu máximo definido.',
    missionXp: 15,
  },
  session_window: {
    weaknessHypothesis: 'Operaste fuera de las ventanas horarias que vos mismo definiste como óptimas.',
    weaknessFix: 'Fuera de tu ventana operativa, la plataforma se cierra. No hay excepción por "se ve bueno".',
    missionTask: 'Marcá la hora de cierre de tu ventana operativa en una alarma y respetala mañana.',
    missionXp: 15,
  },
  no_plan_break: {
    weaknessHypothesis:
      'Marcaste vos mismo que al menos una operación rompió tu plan — no es una lectura externa, es tu propio registro.',
    weaknessFix:
      'La próxima vez que sientas el impulso de romper una regla, cerrás la posición o no la abrís — y lo anotás antes de actuar distinto.',
    missionTask: 'Identificá por escrito, antes de operar mañana, la regla que más rompiste hoy — y no la rompas mañana.',
    missionXp: 20,
  },
  emotional_state: {
    weaknessHypothesis:
      'Predominaron emociones destructivas durante tu operativa — ansiedad, FOMO, venganza o codicia superaron a la calma y la disciplina.',
    weaknessFix:
      'Antes de la próxima sesión, nombrá por escrito qué emoción predominó hoy y qué gatillo la disparó. Nombrarla es el primer freno.',
    missionTask: 'Escribí, antes de operar mañana, qué emoción destructiva predominó hoy y su disparador concreto.',
    missionXp: 15,
  },
};
