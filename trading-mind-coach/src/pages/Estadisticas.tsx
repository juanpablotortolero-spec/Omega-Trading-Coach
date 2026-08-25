import { useEffect, useMemo, useState, type MouseEvent } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useRefresh } from '../contexts/RefreshContext';
import {
  getAllOperations,
  getDisciplineInputsByDate,
  getMacroNewsFlagsByDate,
  getTradingPlan,
  type DisciplineDailyInput,
  type OperationRecord,
} from '../lib/api';
import { localIsoDate } from '../lib/calendar';
import { computeDisciplineTimeline, scoreToColor, type DisciplineOperationInput } from '../lib/disciplineScore';
import AtaraxiaBar from '../components/AtaraxiaBar';

type Period = 'day' | 'week' | 'month' | 'year' | 'all';

const periods: { value: Period; label: string }[] = [
  { value: 'day', label: 'Día' },
  { value: 'week', label: 'Semana' },
  { value: 'month', label: 'Mes' },
  { value: 'year', label: 'Año' },
  { value: 'all', label: 'General' },
];

type AreteRange = 'day' | 'week' | 'month' | 'year' | 'all';

const areteRangeOptions: { value: AreteRange; label: string }[] = [
  { value: 'day', label: 'Día' },
  { value: 'week', label: 'Semana' },
  { value: 'month', label: 'Mes' },
  { value: 'year', label: 'Año' },
  { value: 'all', label: 'General' },
];

function withinAreteRange(dateStr: string, range: AreteRange, today: Date): boolean {
  const date = new Date(`${dateStr}T00:00:00`);
  if (range === 'all') return true;
  if (range === 'day') return dateStr === localIsoDate(today);
  if (range === 'week') {
    const since = new Date(today);
    since.setDate(since.getDate() - 7);
    return date >= since;
  }
  if (range === 'month') return date.getFullYear() === today.getFullYear() && date.getMonth() === today.getMonth();
  return date.getFullYear() === today.getFullYear();
}

const sessionLabels: Record<string, string> = {
  london_open: 'London Open',
  ny_am: 'NY AM Session',
  ny_pm: 'NY PM Session',
  outside_window: 'Fuera de Ventana',
};

function formatMoney(value: number) {
  const sign = value > 0 ? '+' : '';
  return `${sign}$${value.toFixed(2)}`;
}

function formatMoneyCompact(value: number) {
  const sign = value > 0 ? '+' : value < 0 ? '−' : '';
  return `${sign}$${Math.round(Math.abs(value))}`;
}

function formatDateShort(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
}

function Estadisticas() {
  const { user } = useAuth();
  const { version } = useRefresh();

  const [ops, setOps] = useState<OperationRecord[]>([]);
  const [newsFlags, setNewsFlags] = useState<Record<string, boolean>>({});
  const [disciplineInputs, setDisciplineInputs] = useState<Record<string, DisciplineDailyInput>>({});
  const [maxTradesPerSession, setMaxTradesPerSession] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<Period>('month');
  const [filterOpen, setFilterOpen] = useState(false);
  const [areteRange, setAreteRange] = useState<AreteRange>('month');
  const [areteFilterOpen, setAreteFilterOpen] = useState(false);

  const now = new Date();
  const [monthCursor, setMonthCursor] = useState({ year: now.getFullYear(), month: now.getMonth() });
  const [yearCursor, setYearCursor] = useState(now.getFullYear());

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    setLoading(true);
    setError(null);

    Promise.all([
      getAllOperations(user.id),
      getMacroNewsFlagsByDate(user.id),
      getDisciplineInputsByDate(user.id),
      getTradingPlan(user.id),
    ])
      .then(([data, flags, discipline, plan]) => {
        if (cancelled) return;
        setOps(data);
        setNewsFlags(flags);
        setDisciplineInputs(discipline);
        setMaxTradesPerSession(plan?.max_trades_per_session ?? null);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [user, version]);

  const today = new Date();

  const withinPeriod = (dateStr: string): boolean => {
    const date = new Date(`${dateStr}T00:00:00`);
    if (period === 'all') return true;
    if (period === 'day') return dateStr === localIsoDate(today);
    if (period === 'week') {
      const since = new Date(today);
      since.setDate(since.getDate() - 7);
      return date >= since;
    }
    if (period === 'month') {
      return date.getFullYear() === monthCursor.year && date.getMonth() === monthCursor.month;
    }
    return date.getFullYear() === yearCursor;
  };

  const summary = useMemo(() => {
    const sumSince = (days: number) => {
      const since = new Date(today);
      since.setDate(since.getDate() - days);
      return ops
        .filter((op) => op.pnl !== null && new Date(`${op.entry_date}T00:00:00`) >= since)
        .reduce((sum, op) => sum + (op.pnl as number), 0);
    };
    const todaySum = ops
      .filter((op) => op.pnl !== null && op.entry_date === localIsoDate(today))
      .reduce((sum, op) => sum + (op.pnl as number), 0);
    const monthSum = ops
      .filter(
        (op) =>
          op.pnl !== null &&
          new Date(`${op.entry_date}T00:00:00`).getFullYear() === today.getFullYear() &&
          new Date(`${op.entry_date}T00:00:00`).getMonth() === today.getMonth(),
      )
      .reduce((sum, op) => sum + (op.pnl as number), 0);
    const yearSum = ops
      .filter(
        (op) => op.pnl !== null && new Date(`${op.entry_date}T00:00:00`).getFullYear() === today.getFullYear(),
      )
      .reduce((sum, op) => sum + (op.pnl as number), 0);

    return { today: todaySum, week: sumSince(7), month: monthSum, year: yearSum };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ops]);

  const filteredOps = useMemo(() => ops.filter((op) => withinPeriod(op.entry_date)), [ops, period, monthCursor, yearCursor]);

  const metrics = useMemo(() => {
    const scored = filteredOps.filter((op) => op.pnl !== null);
    const wins = scored.filter((op) => (op.pnl as number) > 0).length;
    const winRatePct = scored.length === 0 ? null : Math.round((wins / scored.length) * 100);
    const longs = filteredOps.filter((op) => op.direction === 'long').length;
    const shorts = filteredOps.filter((op) => op.direction === 'short').length;
    const tp = filteredOps.filter((op) => op.outcome === 'TP').length;
    const sl = filteredOps.filter((op) => op.outcome === 'SL').length;
    const be = filteredOps.filter((op) => op.outcome === 'BE').length;

    return { totalTrades: filteredOps.length, winRatePct, longs, shorts, tp, sl, be };
  }, [filteredOps]);

  const outcomeTotal = metrics.tp + metrics.sl + metrics.be;

  const newsBreakdown = useMemo(() => {
    const summarize = (rows: OperationRecord[]) => {
      const scored = rows.filter((op) => op.pnl !== null);
      const wins = scored.filter((op) => (op.pnl as number) > 0).length;
      return {
        count: rows.length,
        winRatePct: scored.length === 0 ? null : Math.round((wins / scored.length) * 100),
        pnl: scored.reduce((sum, op) => sum + (op.pnl as number), 0),
      };
    };

    const withNews = filteredOps.filter((op) => newsFlags[op.entry_date] === true);
    const withoutNews = filteredOps.filter((op) => newsFlags[op.entry_date] === false);

    return { withNews: summarize(withNews), withoutNews: summarize(withoutNews) };
  }, [filteredOps, newsFlags]);

  const areteTimeline = useMemo(() => {
    const opsByDate = new Map<string, DisciplineOperationInput[]>();
    ops.forEach((op) => {
      const list = opsByDate.get(op.entry_date) ?? [];
      list.push({ model: op.model, session: op.session, brokePlan: op.broke_plan });
      opsByDate.set(op.entry_date, list);
    });
    return computeDisciplineTimeline(disciplineInputs, opsByDate, maxTradesPerSession);
  }, [ops, disciplineInputs, maxTradesPerSession]);

  const areteFilteredTimeline = useMemo(
    () => areteTimeline.filter((day) => withinAreteRange(day.date, areteRange, today)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [areteTimeline, areteRange],
  );

  const areteStats = useMemo(() => {
    if (areteFilteredTimeline.length === 0) {
      return { average: null as number | null, delta: null as number | null, topNegatives: [] as { label: string; count: number }[] };
    }
    const average = Math.round(
      areteFilteredTimeline.reduce((sum, day) => sum + day.score, 0) / areteFilteredTimeline.length,
    );
    const withoutLatest = areteFilteredTimeline.slice(0, -1);
    const delta =
      withoutLatest.length === 0
        ? null
        : average - Math.round(withoutLatest.reduce((sum, day) => sum + day.score, 0) / withoutLatest.length);
    const negativeCounts = new Map<string, number>();
    areteFilteredTimeline.forEach((day) => {
      day.negatives.forEach((neg) => negativeCounts.set(neg, (negativeCounts.get(neg) ?? 0) + 1));
    });
    const topNegatives = [...negativeCounts.entries()]
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 3);

    return { average, delta, topNegatives };
  }, [areteFilteredTimeline]);

  const curvePoints = useMemo(() => {
    const scoped = filteredOps.filter((op) => op.pnl !== null);
    const byDate = new Map<string, number>();
    scoped.forEach((op) => {
      byDate.set(op.entry_date, (byDate.get(op.entry_date) ?? 0) + (op.pnl as number));
    });
    const sortedDates = [...byDate.keys()].sort();
    let running = 0;
    return sortedDates.map((date) => {
      running += byDate.get(date) ?? 0;
      return { date, value: running };
    });
  }, [filteredOps]);

  const modelBreakdown = useMemo(() => {
    const groups = new Map<string, { count: number; wins: number; scored: number }>();
    filteredOps.forEach((op) => {
      const key = op.model || 'Sin modelo';
      const group = groups.get(key) ?? { count: 0, wins: 0, scored: 0 };
      group.count += 1;
      if (op.pnl !== null) {
        group.scored += 1;
        if (op.pnl > 0) group.wins += 1;
      }
      groups.set(key, group);
    });
    return [...groups.entries()]
      .map(([model, stats]) => ({
        model,
        count: stats.count,
        winRatePct: stats.scored === 0 ? null : Math.round((stats.wins / stats.scored) * 100),
      }))
      .sort((a, b) => b.count - a.count);
  }, [filteredOps]);

  const recentOps = useMemo(() => [...filteredOps].reverse().slice(0, 10), [filteredOps]);

  const monthLabel = new Date(monthCursor.year, monthCursor.month, 1).toLocaleDateString('es-ES', {
    month: 'long',
    year: 'numeric',
  });

  const goToMonth = (delta: number) => {
    setMonthCursor((current) => {
      const next = new Date(current.year, current.month + delta, 1);
      return { year: next.getFullYear(), month: next.getMonth() };
    });
  };

  if (loading) {
    return <div className="skeleton skeleton-table" />;
  }

  return (
    <>
      <header className="topbar panel">
        <div>
          <p className="eyebrow">Rendimiento</p>
          <h2>Estadísticas</h2>
          <p className="page-description">Análisis de tus operaciones registradas hasta ahora.</p>
        </div>
        <div className="stats-header-controls">
          <div className="stats-filter">
            <button
              type="button"
              className="stats-filter-btn"
              onClick={() => setFilterOpen((v) => !v)}
              aria-label="Filtrar por periodo"
            >
              {periods.find((p) => p.value === period)?.label}
              <span className="stats-filter-chevron">{filterOpen ? '▴' : '▾'}</span>
            </button>
            {filterOpen && (
              <div className="stats-filter-menu">
                {periods.map((p) => (
                  <button
                    key={p.value}
                    type="button"
                    className={`stats-filter-option ${period === p.value ? 'active' : ''}`}
                    onClick={() => {
                      setPeriod(p.value);
                      setFilterOpen(false);
                    }}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {(period === 'month' || period === 'year') && (
            <div className="stats-period-nav">
              <button
                type="button"
                className="icon-btn"
                onClick={() => (period === 'month' ? goToMonth(-1) : setYearCursor((y) => y - 1))}
                aria-label="Periodo anterior"
              >
                ‹
              </button>
              <span className="stats-period-nav-label">{period === 'month' ? monthLabel : yearCursor}</span>
              <button
                type="button"
                className="icon-btn"
                onClick={() => (period === 'month' ? goToMonth(1) : setYearCursor((y) => y + 1))}
                aria-label="Periodo siguiente"
              >
                ›
              </button>
            </div>
          )}
        </div>
      </header>

      {error && <div className="panel error-banner">No se pudieron cargar los datos: {error}</div>}

      {ops.length === 0 ? (
        <section className="panel plan-section">
          <div className="empty-state">
            <span className="empty-icon" />
            <h3>Todavía no hay operaciones para analizar</h3>
            <p>Registra tu primer journal para empezar a ver tus estadísticas aquí.</p>
          </div>
        </section>
      ) : (
        <>
          <section className="metrics-grid">
            <article className="panel metric">
              <span className="eyebrow">P&L Hoy</span>
              <strong className={summary.today >= 0 ? 'bullish' : 'bearish'}>{formatMoney(summary.today)}</strong>
            </article>
            <article className="panel metric">
              <span className="eyebrow">P&L Semanal</span>
              <strong className={summary.week >= 0 ? 'bullish' : 'bearish'}>{formatMoney(summary.week)}</strong>
            </article>
            <article className="panel metric">
              <span className="eyebrow">P&L Mensual</span>
              <strong className={summary.month >= 0 ? 'bullish' : 'bearish'}>{formatMoney(summary.month)}</strong>
            </article>
            <article className="panel metric">
              <span className="eyebrow">P&L Anual</span>
              <strong className={summary.year >= 0 ? 'bullish' : 'bearish'}>{formatMoney(summary.year)}</strong>
            </article>
          </section>

          <section className="metrics-grid metrics-grid-secondary">
            <article className="panel metric metric-hoverable" tabIndex={0}>
              <span className="eyebrow">Winrate</span>
              <strong>{metrics.winRatePct != null ? `${metrics.winRatePct}%` : '—'}</strong>
              <small className="neutral">{filteredOps.filter((o) => o.pnl !== null).length} con P&L</small>

              <div className="metric-hover-panel">
                <span className="metric-hover-title">TP / SL / BE</span>
                <table className="mini-stat-table">
                  <thead>
                    <tr>
                      <th>Resultado</th>
                      <th>Trades</th>
                      <th>%</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="bullish">TP</td>
                      <td>{metrics.tp}</td>
                      <td>{outcomeTotal > 0 ? Math.round((metrics.tp / outcomeTotal) * 100) : 0}%</td>
                    </tr>
                    <tr>
                      <td className="bearish">SL</td>
                      <td>{metrics.sl}</td>
                      <td>{outcomeTotal > 0 ? Math.round((metrics.sl / outcomeTotal) * 100) : 0}%</td>
                    </tr>
                    <tr>
                      <td className="neutral">BE</td>
                      <td>{metrics.be}</td>
                      <td>{outcomeTotal > 0 ? Math.round((metrics.be / outcomeTotal) * 100) : 0}%</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </article>

            <article className="panel metric metric-hoverable" tabIndex={0}>
              <span className="eyebrow">Total de Trades</span>
              <strong>{metrics.totalTrades}</strong>

              <div className="metric-hover-panel">
                <span className="metric-hover-title">Longs vs Shorts</span>
                <table className="mini-stat-table">
                  <thead>
                    <tr>
                      <th>Dirección</th>
                      <th>Trades</th>
                      <th>%</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="bullish">Long</td>
                      <td>{metrics.longs}</td>
                      <td>
                        {metrics.totalTrades > 0 ? Math.round((metrics.longs / metrics.totalTrades) * 100) : 0}%
                      </td>
                    </tr>
                    <tr>
                      <td className="bearish">Short</td>
                      <td>{metrics.shorts}</td>
                      <td>
                        {metrics.totalTrades > 0 ? Math.round((metrics.shorts / metrics.totalTrades) * 100) : 0}%
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </article>
          </section>

          <section className="panel plan-section">
            <h3>Desempeño con y sin noticias</h3>
            {newsBreakdown.withNews.count === 0 && newsBreakdown.withoutNews.count === 0 ? (
              <p className="hint-text">
                Aún no hay journals guardados con el registro de noticias activado. Esto se completa solo, a
                partir de ahora, cada vez que guardes un journal con el calendario económico cargado.
              </p>
            ) : (
              <div className="news-compare-grid">
                <div className="news-compare-col">
                  <span className="eyebrow">Con noticias en sesión</span>
                  <strong>
                    {newsBreakdown.withNews.winRatePct != null ? `${newsBreakdown.withNews.winRatePct}%` : '—'}
                  </strong>
                  <span className={newsBreakdown.withNews.pnl >= 0 ? 'bullish' : 'bearish'}>
                    {formatMoney(newsBreakdown.withNews.pnl)}
                  </span>
                  <span className="hint-text">{newsBreakdown.withNews.count} trades</span>
                </div>
                <div className="news-compare-col">
                  <span className="eyebrow">Sin noticias en sesión</span>
                  <strong>
                    {newsBreakdown.withoutNews.winRatePct != null ? `${newsBreakdown.withoutNews.winRatePct}%` : '—'}
                  </strong>
                  <span className={newsBreakdown.withoutNews.pnl >= 0 ? 'bullish' : 'bearish'}>
                    {formatMoney(newsBreakdown.withoutNews.pnl)}
                  </span>
                  <span className="hint-text">{newsBreakdown.withoutNews.count} trades</span>
                </div>
              </div>
            )}
          </section>

          <section className="panel plan-section">
            <div className="section-header">
              <h3>Ataraxia</h3>
              <div className="stats-filter">
                <button
                  type="button"
                  className="stats-filter-btn"
                  onClick={() => setAreteFilterOpen((open) => !open)}
                >
                  {areteRangeOptions.find((option) => option.value === areteRange)?.label}
                  <span className="stats-filter-chevron">{areteFilterOpen ? '▴' : '▾'}</span>
                </button>
                {areteFilterOpen && (
                  <div className="stats-filter-menu">
                    {areteRangeOptions.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        className={`stats-filter-option ${areteRange === option.value ? 'active' : ''}`}
                        onClick={() => {
                          setAreteRange(option.value);
                          setAreteFilterOpen(false);
                        }}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <p className="hint-text">
              Qué tan bien sigues las reglas de tu Manual Operativo, según tus journals y operaciones de este
              periodo.
            </p>
            {areteStats.average === null ? (
              <p className="hint-text">
                Aún no hay suficiente información en tus journals de este periodo para calcular tu Ataraxia. Se
                completa a partir de tus respuestas del Quiz Post-Mercado y tus operaciones.
              </p>
            ) : (
              <>
                <AtaraxiaBar score={areteStats.average} animated delta={areteStats.delta} />
                <AreteChart points={areteFilteredTimeline} />
                {areteStats.topNegatives.length > 0 && (
                  <div className="arete-col" style={{ marginTop: 12 }}>
                    <span className="eyebrow">Patrones a corregir</span>
                    <ul>
                      {areteStats.topNegatives.map((item) => (
                        <li key={item.label}>
                          {item.label} <span className="hint-text">({item.count}×)</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            )}
          </section>

          <section className="panel plan-section">
            <h3>Curva de Equity</h3>
            <EquityCurve points={curvePoints} />
          </section>

          <section className="content-grid">
            <article className="panel trade-table-panel">
              <div className="section-header">
                <div>
                  <p className="eyebrow">Bitácora</p>
                  <h3>Setups recientes</h3>
                </div>
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Fecha</th>
                      <th>Sesión</th>
                      <th>Símbolo</th>
                      <th>Modelo</th>
                      <th>Calidad</th>
                      <th>Resultado</th>
                      <th>P&L</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentOps.map((op) => (
                      <tr key={op.id}>
                        <td>{formatDateShort(op.entry_date)}</td>
                        <td>{op.session ? sessionLabels[op.session] : '—'}</td>
                        <td>{op.symbol}</td>
                        <td>{op.model ?? '—'}</td>
                        <td>{op.quality ?? '—'}</td>
                        <td>{op.outcome ?? '—'}</td>
                        <td className={op.pnl !== null ? (op.pnl >= 0 ? 'bullish' : 'bearish') : ''}>
                          {op.pnl !== null ? formatMoney(op.pnl) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </article>

            <article className="panel virtue-panel">
              <div className="section-header">
                <div>
                  <p className="eyebrow">Modelos</p>
                  <h3>Ejecuciones y Winrate</h3>
                </div>
              </div>
              <div className="virtue-list">
                {modelBreakdown.map((row) => (
                  <div className="virtue-item positive" key={row.model}>
                    <span>
                      {row.model} · {row.count}×
                    </span>
                    <strong>{row.winRatePct != null ? `${row.winRatePct}%` : '—'}</strong>
                  </div>
                ))}
              </div>
            </article>
          </section>
        </>
      )}
    </>
  );
}

function EquityCurve({ points }: { points: { date: string; value: number }[] }) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const width = 680;
  const height = 260;
  const paddingLeft = 56;
  const paddingRight = 16;
  const paddingTop = 20;
  const paddingBottom = 30;

  if (points.length < 2) {
    return (
      <div className="empty-state">
        <span className="empty-icon" />
        <h3>Necesitas al menos 2 operaciones con P&L</h3>
        <p>Registra el resultado de tus operaciones para ver tu curva de equity en este periodo.</p>
      </div>
    );
  }

  const values = points.map((point) => point.value);
  const minVal = Math.min(0, ...values);
  const maxVal = Math.max(0, ...values);
  const span = maxVal - minVal || 1;

  const plotWidth = width - paddingLeft - paddingRight;
  const plotHeight = height - paddingTop - paddingBottom;

  const xStep = plotWidth / (points.length - 1);
  const yFor = (value: number) => paddingTop + plotHeight - ((value - minVal) / span) * plotHeight;
  const xFor = (index: number) => paddingLeft + index * xStep;

  const linePath = points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${xFor(index)} ${yFor(point.value)}`).join(' ');
  const zeroY = yFor(0);
  const areaPath = `${linePath} L ${xFor(points.length - 1)} ${zeroY} L ${xFor(0)} ${zeroY} Z`;

  const last = points[points.length - 1];
  const hovered = hoverIndex !== null ? points[hoverIndex] : null;

  const yTicks = [...new Set([maxVal, (maxVal + minVal) / 2, minVal])];
  const xTickIndices =
    points.length <= 2 ? [0, points.length - 1] : [0, Math.floor((points.length - 1) / 2), points.length - 1];

  const handleMove = (event: MouseEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const relativeX = ((event.clientX - rect.left) / rect.width) * width;
    const index = Math.round((relativeX - paddingLeft) / xStep);
    setHoverIndex(Math.min(points.length - 1, Math.max(0, index)));
  };

  return (
    <div className="equity-chart-wrap">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="equity-chart"
        onMouseMove={handleMove}
        onMouseLeave={() => setHoverIndex(null)}
      >
        {yTicks.map((tick, i) => (
          <g key={i}>
            <line x1={paddingLeft} y1={yFor(tick)} x2={width - paddingRight} y2={yFor(tick)} className="equity-gridline" />
            <text x={paddingLeft - 10} y={yFor(tick)} className="equity-axis-label" textAnchor="end" dominantBaseline="middle">
              {formatMoneyCompact(tick)}
            </text>
          </g>
        ))}

        <path d={areaPath} className="equity-area" />
        <path d={linePath} className="equity-line" />

        {xTickIndices.map((i) => (
          <text key={i} x={xFor(i)} y={height - 8} className="equity-axis-label" textAnchor="middle">
            {formatDateShort(points[i].date)}
          </text>
        ))}

        {hoverIndex !== null && (
          <line
            x1={xFor(hoverIndex)}
            y1={paddingTop}
            x2={xFor(hoverIndex)}
            y2={height - paddingBottom}
            className="equity-crosshair"
          />
        )}
        <circle cx={xFor(points.length - 1)} cy={yFor(last.value)} r={5} className="equity-end-dot" />
        {hovered && hoverIndex !== null && (
          <circle cx={xFor(hoverIndex)} cy={yFor(hovered.value)} r={5} className="equity-hover-dot" />
        )}
      </svg>
      <div className={`equity-end-label ${last.value >= 0 ? 'bullish' : 'bearish'}`}>{formatMoney(last.value)}</div>

      {hovered && hoverIndex !== null && (
        <div className="equity-tooltip" style={{ left: `${(xFor(hoverIndex) / width) * 100}%` }}>
          <strong className={hovered.value >= 0 ? 'bullish' : 'bearish'}>{formatMoney(hovered.value)}</strong>
          <span>{formatDateShort(hovered.date)}</span>
        </div>
      )}
    </div>
  );
}

// Curva suave (Catmull-Rom simplificada vía Bézier cúbica por segmento) en
// vez de tramos rectos — pasa exactamente por cada punto real, sin librerías.
function buildSmoothPath(coords: { x: number; y: number }[]): string {
  if (coords.length === 0) return '';
  let d = `M ${coords[0].x} ${coords[0].y}`;
  for (let i = 0; i < coords.length - 1; i += 1) {
    const p0 = coords[i];
    const p1 = coords[i + 1];
    const midX = (p0.x + p1.x) / 2;
    d += ` C ${midX} ${p0.y}, ${midX} ${p1.y}, ${p1.x} ${p1.y}`;
  }
  return d;
}

function AreteChart({ points }: { points: { date: string; score: number }[] }) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const width = 680;
  const height = 220;
  const paddingLeft = 40;
  const paddingRight = 16;
  const paddingTop = 16;
  const paddingBottom = 28;

  if (points.length < 2) {
    return (
      <div className="empty-state">
        <span className="empty-icon" />
        <h3>Necesitas al menos 2 días con datos</h3>
        <p>Completa más journals en este periodo para ver la evolución de tu Ataraxia.</p>
      </div>
    );
  }

  const plotWidth = width - paddingLeft - paddingRight;
  const plotHeight = height - paddingTop - paddingBottom;
  const xStep = points.length > 1 ? plotWidth / (points.length - 1) : 0;
  const yFor = (value: number) => paddingTop + plotHeight - (value / 100) * plotHeight;
  const xFor = (index: number) => paddingLeft + index * xStep;

  const coords = points.map((point, index) => ({ x: xFor(index), y: yFor(point.score) }));
  const linePath = buildSmoothPath(coords);
  const zeroY = yFor(0);
  const areaPath = `${linePath} L ${coords[coords.length - 1].x} ${zeroY} L ${coords[0].x} ${zeroY} Z`;

  const last = points[points.length - 1];
  const hovered = hoverIndex !== null ? points[hoverIndex] : null;
  const xTickIndices =
    points.length <= 2 ? [0, points.length - 1] : [0, Math.floor((points.length - 1) / 2), points.length - 1];

  const handleMove = (event: MouseEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const relativeX = ((event.clientX - rect.left) / rect.width) * width;
    const index = Math.round((relativeX - paddingLeft) / xStep);
    setHoverIndex(Math.min(points.length - 1, Math.max(0, index)));
  };

  return (
    <div className="ataraxia-chart-wrap">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="ataraxia-chart"
        onMouseMove={handleMove}
        onMouseLeave={() => setHoverIndex(null)}
      >
        <defs>
          {/* Mismos cortes que scoreToColor()/la barra: anclado en
              coordenadas fijas (userSpaceOnUse) para que el color siempre
              represente el mismo valor absoluto 0-100, sin importar el
              rango real de los puntos visibles en este periodo. */}
          <linearGradient id="ataraxiaLineGradient" gradientUnits="userSpaceOnUse" x1="0" y1={yFor(100)} x2="0" y2={yFor(0)}>
            <stop offset="0%" stopColor="#4a6b82" />
            <stop offset="15%" stopColor="#4a6b82" />
            <stop offset="35%" stopColor="#8a6b4e" />
            <stop offset="55%" stopColor="#8a6b4e" />
            <stop offset="75%" stopColor="#8b3a36" />
            <stop offset="100%" stopColor="#8b3a36" />
          </linearGradient>
        </defs>

        {[0, 50, 100].map((tick) => (
          <g key={tick}>
            <line
              x1={paddingLeft}
              y1={yFor(tick)}
              x2={width - paddingRight}
              y2={yFor(tick)}
              className="ataraxia-chart-gridline"
            />
            <text x={paddingLeft - 10} y={yFor(tick)} className="ataraxia-chart-axis-label" textAnchor="end" dominantBaseline="middle">
              {tick}%
            </text>
          </g>
        ))}

        <path d={areaPath} fill="url(#ataraxiaLineGradient)" fillOpacity="0.12" stroke="none" />
        <path d={linePath} fill="none" stroke="url(#ataraxiaLineGradient)" strokeWidth="2.5" strokeLinecap="round" />

        {coords.map((coord, index) => (
          <circle
            key={points[index].date}
            cx={coord.x}
            cy={coord.y}
            r={index === hoverIndex || index === points.length - 1 ? 5 : 3}
            fill={scoreToColor(points[index].score)}
            stroke="var(--bg-app)"
            strokeWidth={index === hoverIndex || index === points.length - 1 ? 2 : 1}
          />
        ))}

        {xTickIndices.map((i) => (
          <text key={i} x={xFor(i)} y={height - 8} className="ataraxia-chart-axis-label" textAnchor="middle">
            {formatDateShort(points[i].date)}
          </text>
        ))}

        {hoverIndex !== null && (
          <line
            x1={xFor(hoverIndex)}
            y1={paddingTop}
            x2={xFor(hoverIndex)}
            y2={height - paddingBottom}
            className="ataraxia-chart-crosshair"
          />
        )}
      </svg>
      <div className="ataraxia-chart-end-label" style={{ color: scoreToColor(last.score) }}>
        {last.score}%
      </div>

      {hovered && hoverIndex !== null && (
        <div className="ataraxia-chart-tooltip" style={{ left: `${(xFor(hoverIndex) / width) * 100}%` }}>
          <strong style={{ color: scoreToColor(hovered.score) }}>{hovered.score}%</strong>
          <span>{formatDateShort(hovered.date)}</span>
        </div>
      )}
    </div>
  );
}

export default Estadisticas;
