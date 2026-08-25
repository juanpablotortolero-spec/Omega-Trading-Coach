import { localIsoDate } from './calendar';

export type EconomicEvent = {
  title: string;
  country: string;
  date: string;
  impact: string;
  forecast: string;
  previous: string;
};

const FEED_URL = 'https://nfs.faireconomy.media/ff_calendar_thisweek.json';
// ForexFactory has no official public API. This is the unofficial feed most
// trading tools use, fetched through a public CORS proxy since the browser
// can't call it directly. If the proxy ever goes down, swap this for a
// Supabase Edge Function that fetches the feed server-side instead.
const PROXY_URL = `https://corsproxy.io/?url=${encodeURIComponent(FEED_URL)}`;

let cache: { data: EconomicEvent[]; fetchedAt: number } | null = null;
const CACHE_TTL_MS = 30 * 60 * 1000;

export async function getWeeklyEconomicEvents(): Promise<EconomicEvent[]> {
  if (cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) {
    return cache.data;
  }

  const response = await fetch(PROXY_URL);
  if (!response.ok) throw new Error('No se pudo cargar el calendario económico.');

  const data = (await response.json()) as EconomicEvent[];
  cache = { data, fetchedAt: Date.now() };
  return data;
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
