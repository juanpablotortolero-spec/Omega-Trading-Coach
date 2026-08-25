import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import MonthCalendar from '../components/MonthCalendar';
import MiniMonth from '../components/MiniMonth';
import { useAuth } from '../contexts/AuthContext';
import { useRefresh } from '../contexts/RefreshContext';
import { dateKey, summarizeOperationsByDate, type DaySummary } from '../lib/calendar';
import { getOperationsInRange } from '../lib/api';

type ViewMode = 'month' | 'year';

function Historial() {
  const { user } = useAuth();
  const { version } = useRefresh();
  const navigate = useNavigate();

  const now = new Date();
  const todayKey = dateKey(now.getFullYear(), now.getMonth(), now.getDate());
  const [viewMode, setViewMode] = useState<ViewMode>('month');
  const [cursor, setCursor] = useState({ year: now.getFullYear(), month: now.getMonth() });
  const [yearCursor, setYearCursor] = useState(now.getFullYear());
  const [summaryByDate, setSummaryByDate] = useState<Record<string, DaySummary>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    const start = viewMode === 'month' ? dateKey(cursor.year, cursor.month, 1) : dateKey(yearCursor, 0, 1);
    const end =
      viewMode === 'month'
        ? dateKey(cursor.year, cursor.month, new Date(cursor.year, cursor.month + 1, 0).getDate())
        : dateKey(yearCursor, 11, 31);

    setLoading(true);
    setError(null);

    getOperationsInRange(user.id, start, end)
      .then((ops) => {
        if (cancelled) return;
        setSummaryByDate(summarizeOperationsByDate(ops));
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
  }, [user, viewMode, cursor, yearCursor, version]);

  const monthLabel = new Date(cursor.year, cursor.month, 1).toLocaleDateString('es-ES', {
    month: 'long',
    year: 'numeric',
  });

  const goToMonth = (delta: number) => {
    setCursor((current) => {
      const next = new Date(current.year, current.month + delta, 1);
      return { year: next.getFullYear(), month: next.getMonth() };
    });
  };

  const goToMonthView = (month: number) => {
    setCursor({ year: yearCursor, month });
    setViewMode('month');
  };

  return (
    <>
      <header className="topbar panel">
        <div>
          <p className="eyebrow">Bitácora Mensual</p>
          <h2>Historial</h2>
          <p className="page-description">Toca cualquier día para ver o registrar el journal de esa fecha.</p>
        </div>
        <div className="pill-row">
          <button
            type="button"
            className={`pill-btn gold small ${viewMode === 'month' ? 'active' : ''}`}
            onClick={() => setViewMode('month')}
          >
            Mes
          </button>
          <button
            type="button"
            className={`pill-btn gold small ${viewMode === 'year' ? 'active' : ''}`}
            onClick={() => setViewMode('year')}
          >
            Año
          </button>
        </div>
      </header>

      {error && <div className="panel error-banner">No se pudieron cargar los datos: {error}</div>}

      {viewMode === 'month' ? (
        <section className="panel plan-section">
          <div className="calendar-nav">
            <button type="button" className="icon-btn" onClick={() => goToMonth(-1)} aria-label="Mes anterior">
              ‹
            </button>
            <h3 style={{ textTransform: 'capitalize' }}>{monthLabel}</h3>
            <button type="button" className="icon-btn" onClick={() => goToMonth(1)} aria-label="Mes siguiente">
              ›
            </button>
          </div>

          <MonthCalendar
            year={cursor.year}
            month={cursor.month}
            summaryByDate={summaryByDate}
            todayKey={todayKey}
            onDayClick={(key) => navigate(`/journal/nuevo?date=${key}`)}
          />

          {loading && <div className="skeleton skeleton-table" style={{ marginTop: 12 }} />}
        </section>
      ) : (
        <section className="panel plan-section">
          <div className="calendar-nav">
            <button
              type="button"
              className="icon-btn"
              onClick={() => setYearCursor((y) => y - 1)}
              aria-label="Año anterior"
            >
              ‹
            </button>
            <h3>{yearCursor}</h3>
            <button
              type="button"
              className="icon-btn"
              onClick={() => setYearCursor((y) => y + 1)}
              aria-label="Año siguiente"
            >
              ›
            </button>
          </div>

          <div className="year-grid">
            {Array.from({ length: 12 }, (_, month) => (
              <MiniMonth
                key={month}
                year={yearCursor}
                month={month}
                summaryByDate={summaryByDate}
                todayKey={todayKey}
                onDayClick={(key) => navigate(`/journal/nuevo?date=${key}`)}
                onHeaderClick={() => goToMonthView(month)}
              />
            ))}
          </div>

          {loading && <div className="skeleton skeleton-table" style={{ marginTop: 12 }} />}
        </section>
      )}
    </>
  );
}

export default Historial;
