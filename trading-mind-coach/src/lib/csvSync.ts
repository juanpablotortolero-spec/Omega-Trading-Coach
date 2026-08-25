import Papa from 'papaparse';
import type { Direction } from './api';

export type SyncPlatform = 'tradovate' | 'ninjatrader' | 'tradingview' | 'lucid';

export type ParsedTrade = {
  ticker: string;
  direction: Direction | null;
  lotSize: number | null;
  entryTime: string | null;
  exitTime: string | null;
  netPnl: number | null;
};

export type ParseResult =
  | { ok: true; platform: SyncPlatform; platformLabel: string; trades: ParsedTrade[]; skipped: number }
  | { ok: false; error: string };

type ColumnAliases = {
  ticker: string[];
  direction: string[];
  lotSize: string[];
  entryTime: string[];
  exitTime: string[];
  netPnl: string[];
};

type PlatformProfile = {
  id: SyncPlatform;
  label: string;
  /** Headers (normalizados) usados SOLO para identificar la plataforma. */
  fingerprint: string[];
  aliases: ColumnAliases;
};

/**
 * Un "perfil" por plataforma — declarativo a propósito. Agregar o corregir
 * una plataforma es editar este arreglo, nunca tocar la lógica de detección
 * ni de mapeo. Los nombres de columna están basados en los formatos de
 * exportación más comunes de cada una; pueden variar según versión/config,
 * así que conviene validarlos contra un CSV real y ajustar los alias aquí.
 */
const PLATFORM_PROFILES: PlatformProfile[] = [
  {
    id: 'tradovate',
    label: 'Tradovate',
    fingerprint: ['boughttimestamp', 'soldtimestamp', 'pnl', 'contract', 'b/s'],
    aliases: {
      ticker: ['contract', 'symbol'],
      direction: ['b/s', 'side'],
      lotSize: ['filled qty', 'qty'],
      entryTime: ['boughttimestamp', 'entry time'],
      exitTime: ['soldtimestamp', 'exit time'],
      netPnl: ['pnl', 'p/l'],
    },
  },
  {
    id: 'ninjatrader',
    label: 'NinjaTrader',
    fingerprint: ['instrument', 'market pos.', 'entry time', 'exit time', 'profit'],
    aliases: {
      ticker: ['instrument'],
      direction: ['market pos.', 'market pos'],
      lotSize: ['qty'],
      entryTime: ['entry time'],
      exitTime: ['exit time'],
      netPnl: ['profit', 'net profit'],
    },
  },
  {
    id: 'tradingview',
    label: 'TradingView',
    fingerprint: ['symbol', 'type', 'date/time', 'profit', 'contracts'],
    aliases: {
      ticker: ['symbol', 'ticker'],
      direction: ['type', 'side'],
      lotSize: ['contracts', 'quantity'],
      entryTime: ['date/time'],
      exitTime: ['date/time'],
      netPnl: ['profit', 'p&l'],
    },
  },
  {
    // Panel de reporting de prop firms sobre infraestructura Tradovate (ej.
    // Lucid Trading) — no exponen la API de Tradovate directamente, pero su
    // tabla "Trading History" se puede copiar y pegar. No trae columna de
    // dirección (long/short), así que esa queda null para estos trades.
    id: 'lucid',
    label: 'Lucid Trading',
    fingerprint: ['net pnl', 'pnl high', 'pnl low', 'win duration', 'loss duration'],
    aliases: {
      ticker: ['symbol'],
      direction: [],
      lotSize: ['qty'],
      entryTime: ['date'],
      exitTime: ['date'],
      netPnl: ['net pnl', 'net p&l'],
    },
  },
];

const MIN_FINGERPRINT_MATCHES = 3;

function normalizeHeader(header: string): string {
  return header.trim().toLowerCase();
}

export function detectPlatform(headers: string[]): PlatformProfile | null {
  const normalized = new Set(headers.map(normalizeHeader));

  let best: { profile: PlatformProfile; score: number } | null = null;
  for (const profile of PLATFORM_PROFILES) {
    const score = profile.fingerprint.filter((column) => normalized.has(column)).length;
    if (score >= MIN_FINGERPRINT_MATCHES && (!best || score > best.score)) {
      best = { profile, score };
    }
  }
  return best?.profile ?? null;
}

function findValue(row: Record<string, string>, normalizedKeys: Map<string, string>, aliases: string[]): string {
  for (const alias of aliases) {
    const originalKey = normalizedKeys.get(alias);
    if (originalKey !== undefined && row[originalKey]?.trim()) {
      return row[originalKey].trim();
    }
  }
  return '';
}

function parseDirection(raw: string): Direction | null {
  const value = raw.trim().toLowerCase();
  if (['long', 'buy', 'b', 'bought'].includes(value)) return 'long';
  if (['short', 'sell', 's', 'sold'].includes(value)) return 'short';
  return null;
}

function parseNumber(raw: string): number | null {
  if (!raw) return null;
  const cleaned = raw.replace(/[$,]/g, '').replace(/^\((.*)\)$/, '-$1').trim();
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseDateTime(raw: string): string | null {
  if (!raw) return null;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

const UNRECOGNIZED_PLATFORM_ERROR =
  'No se pudo reconocer la plataforma de esta tabla. Verifica que sea un export de Tradovate, NinjaTrader, TradingView o Lucid Trading.';

function buildResult(headers: string[], rows: Record<string, string>[]): ParseResult {
  const profile = detectPlatform(headers);
  if (!profile) {
    return { ok: false, error: UNRECOGNIZED_PLATFORM_ERROR };
  }

  const normalizedKeys = new Map(headers.map((header) => [normalizeHeader(header), header]));

  let skipped = 0;
  const trades: ParsedTrade[] = [];
  for (const row of rows) {
    const ticker = findValue(row, normalizedKeys, profile.aliases.ticker);
    const entryTime = parseDateTime(findValue(row, normalizedKeys, profile.aliases.entryTime));
    const netPnl = parseNumber(findValue(row, normalizedKeys, profile.aliases.netPnl));

    if (!ticker || (entryTime === null && netPnl === null)) {
      skipped += 1;
      continue;
    }

    trades.push({
      ticker,
      direction: parseDirection(findValue(row, normalizedKeys, profile.aliases.direction)),
      lotSize: parseNumber(findValue(row, normalizedKeys, profile.aliases.lotSize)),
      entryTime,
      exitTime: parseDateTime(findValue(row, normalizedKeys, profile.aliases.exitTime)),
      netPnl,
    });
  }

  return { ok: true, platform: profile.id, platformLabel: profile.label, trades, skipped };
}

export function parseCsvFile(file: File): Promise<ParseResult> {
  return new Promise((resolve) => {
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => resolve(buildResult(results.meta.fields ?? [], results.data)),
      error: (error: Error) => {
        resolve({ ok: false, error: error.message || 'No se pudo leer el archivo CSV.' });
      },
    });
  });
}

/**
 * Para plataformas sin botón de exportar (ej. el panel de Lucid Trading):
 * el usuario copia la tabla directamente del navegador (Ctrl+C sobre las
 * filas) y la pega aquí. PapaParse detecta el delimitador solo (la mayoría
 * de navegadores copian tablas HTML como texto separado por tabs).
 */
export function parsePastedTable(text: string): ParseResult {
  const trimmed = text.trim();
  if (!trimmed) {
    return { ok: false, error: 'Pega el contenido de la tabla antes de importar.' };
  }

  const results = Papa.parse<Record<string, string>>(trimmed, {
    header: true,
    skipEmptyLines: true,
    delimiter: '',
  });

  if (results.errors.some((err) => err.type === 'Delimiter')) {
    return { ok: false, error: 'No se pudo detectar el formato de la tabla pegada.' };
  }

  return buildResult(results.meta.fields ?? [], results.data);
}
