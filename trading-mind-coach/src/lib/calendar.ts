import type { OperationRecord } from './api';

export const weekdayLabels = ['LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB', 'DOM'];

export function pad(value: number) {
  return String(value).padStart(2, '0');
}

export function dateKey(year: number, month: number, day: number) {
  return `${year}-${pad(month + 1)}-${pad(day)}`;
}

/**
 * YYYY-MM-DD for a Date using its local calendar fields (year/month/day as
 * the user's device clock sees them), not `toISOString()` — that converts
 * to UTC first, which silently shifts "today" by a day near midnight for
 * anyone outside UTC.
 */
export function localIsoDate(date: Date): string {
  return dateKey(date.getFullYear(), date.getMonth(), date.getDate());
}

export function buildWeeks(year: number, month: number): (number | null)[][] {
  const firstDay = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const mondayIndex = (firstDay.getDay() + 6) % 7;

  const cells: (number | null)[] = Array(mondayIndex).fill(null);
  for (let day = 1; day <= daysInMonth; day += 1) cells.push(day);
  while (cells.length % 7 !== 0) cells.push(null);

  const weeks: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

export function formatMoney(value: number) {
  const sign = value > 0 ? '+' : '';
  return `${sign}$${value.toFixed(2)}`;
}

export type DaySummary = {
  pnl: number;
  hasPnl: boolean;
  count: number;
  models: string[];
};

export function summarizeOperationsByDate(ops: OperationRecord[]): Record<string, DaySummary> {
  const summaries: Record<string, DaySummary> = {};
  ops.forEach((op) => {
    const day = (summaries[op.entry_date] ??= { pnl: 0, hasPnl: false, count: 0, models: [] });
    day.count += 1;
    if (op.pnl !== null) {
      day.pnl += op.pnl;
      day.hasPnl = true;
    }
    if (op.model && !day.models.includes(op.model)) {
      day.models.push(op.model);
    }
  });
  return summaries;
}
