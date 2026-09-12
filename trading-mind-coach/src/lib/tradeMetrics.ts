/**
 * Factor de beneficio = ganancia bruta / pérdida bruta (en valor absoluto).
 * `null` (mostrar "—") cuando todavía no hay operaciones perdedoras — un
 * cociente por cero no es "infinito ganador", es un dato insuficiente.
 */
export function computeProfitFactor(ops: { pnl: number | null }[]): number | null {
  const grossProfit = ops.filter((op) => (op.pnl ?? 0) > 0).reduce((sum, op) => sum + (op.pnl as number), 0);
  const grossLoss = Math.abs(ops.filter((op) => (op.pnl ?? 0) < 0).reduce((sum, op) => sum + (op.pnl as number), 0));
  if (grossLoss === 0) return null;
  return grossProfit / grossLoss;
}

export function computeWinRatePct(ops: { pnl: number | null }[]): number | null {
  const scored = ops.filter((op) => op.pnl !== null);
  if (scored.length === 0) return null;
  const wins = scored.filter((op) => (op.pnl as number) > 0).length;
  return Math.round((wins / scored.length) * 100);
}

/** Tally genérico "más frecuente primero" — mismo patrón que topNegatives en Estadisticas.tsx. */
export function tallyLabels(lists: string[][], limit = 5): { label: string; count: number }[] {
  const counts = new Map<string, number>();
  lists.forEach((labels) => {
    labels.forEach((label) => counts.set(label, (counts.get(label) ?? 0) + 1));
  });
  return [...counts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

/** Clave de semana ISO-ish (lunes de esa semana, YYYY-MM-DD) — agrupa por semana calendario real. */
export function weekBucketKey(dateStr: string): string {
  const date = new Date(`${dateStr}T12:00:00`);
  const mondayOffset = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - mondayOffset);
  return date.toISOString().slice(0, 10);
}

export function monthBucketKey(dateStr: string): string {
  return dateStr.slice(0, 7);
}
