/**
 * % de distancia ya consumida hacia la quema de una cuenta de fondeo —
 * misma fórmula usada tanto por el candado de riesgo de Omega
 * (useOmegaAgent.ts) como por el panel de Gestor de Riesgo, para que nunca
 * se desincronicen entre sí.
 */
export function computeDangerPct(startingBalance: number, currentBalance: number, drawdownLimit: number): number {
  return Math.round(
    Math.min(100, Math.max(0, ((startingBalance - currentBalance) / (startingBalance - drawdownLimit)) * 100)),
  );
}

/** Mismo umbral que RISK_LOCK_DANGER_PCT en supabase/functions/_shared/omega.ts — duplicado porque corren en runtimes distintos (Deno vs. navegador). */
export const RISK_LOCK_DANGER_PCT = 80;
