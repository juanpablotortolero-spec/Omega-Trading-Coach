import { readFunctionErrorMessage } from './functionsError';
import { localIsoDate } from './calendar';
import { supabase } from './supabaseClient';

export type EconomicEvent = {
  title: string;
  country: string;
  date: string;
  impact: string;
  forecast: string;
  previous: string;
};

let cache: { data: EconomicEvent[]; fetchedAt: number } | null = null;
const CACHE_TTL_MS = 30 * 60 * 1000;

/**
 * ForexFactory has no official public API and its unofficial feed has no
 * CORS headers, so the browser can't call it directly. This used to go
 * through a public CORS proxy (corsproxy.io) — fragile in production since
 * every user shared that same third-party point of failure. Fetching it
 * server-side (Edge Function `economic-calendar`) removes the proxy
 * entirely: a server calling another server has no CORS restriction.
 */
export async function getWeeklyEconomicEvents(): Promise<EconomicEvent[]> {
  if (cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) {
    return cache.data;
  }

  const { data, error } = await supabase.functions.invoke('economic-calendar');
  if (error) {
    throw new Error(await readFunctionErrorMessage(error, 'No se pudo cargar el calendario económico.'));
  }

  const events = data as EconomicEvent[];
  cache = { data: events, fetchedAt: Date.now() };
  return events;
}

export function getEventsForDate(events: EconomicEvent[], isoDate: string): EconomicEvent[] {
  return events
    .filter((event) => localIsoDate(new Date(event.date)) === isoDate)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

/**
 * The feed only covers the current calendar week, so a date outside that
 * range has no data to check — we shouldn't record "no news" for a day we
 * simply never looked at.
 */
export function isWithinFetchedWeek(isoDate: string): boolean {
  const now = new Date();
  const mondayOffset = (now.getDay() + 6) % 7;
  const monday = new Date(now);
  monday.setDate(now.getDate() - mondayOffset);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return isoDate >= localIsoDate(monday) && isoDate <= localIsoDate(sunday);
}

/**
 * Matches free-text "no trade days" notes (e.g. "días de NFP y FOMC")
 * against the day's actual events, so the trader gets reminded when their
 * own rule and the calendar collide. ForexFactory rarely spells out "NFP"
 * in a title — it's usually "Non-Farm Employment Change" — hence the alias
 * list instead of a literal substring match.
 */
const NEWS_KEYWORD_ALIASES: Record<string, string[]> = {
  nfp: ['non-farm', 'nonfarm', 'non farm', 'nfp', 'payrolls'],
  fomc: ['fomc'],
  cpi: ['cpi', 'consumer price index'],
};

export type PlanNewsWarning = { keyword: string; events: EconomicEvent[] };

export function findPlanNewsWarnings(
  noTradeDays: string | null | undefined,
  events: EconomicEvent[],
): PlanNewsWarning[] {
  if (!noTradeDays) return [];
  const planText = noTradeDays.toLowerCase();

  return Object.entries(NEWS_KEYWORD_ALIASES)
    .filter(([keyword]) => planText.includes(keyword))
    .map(([keyword, aliases]) => ({
      keyword,
      events: events.filter((event) => aliases.some((alias) => event.title.toLowerCase().includes(alias))),
    }))
    .filter((warning) => warning.events.length > 0);
}
