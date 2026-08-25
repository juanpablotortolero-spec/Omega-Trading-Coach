import { buildWeeks, dateKey, type DaySummary } from '../lib/calendar';

const miniWeekdayLabels = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

function MiniMonth({
  year,
  month,
  summaryByDate,
  todayKey,
  onDayClick,
  onHeaderClick,
}: {
  year: number;
  month: number;
  summaryByDate: Record<string, DaySummary>;
  todayKey: string;
  onDayClick: (key: string) => void;
  onHeaderClick: () => void;
}) {
  const weeks = buildWeeks(year, month);
  const monthLabel = new Date(year, month, 1).toLocaleDateString('es-ES', { month: 'long' });

  return (
    <div className="mini-month">
      <button type="button" className="mini-month-header" onClick={onHeaderClick}>
        {monthLabel}
      </button>
      <div className="mini-month-weekdays">
        {miniWeekdayLabels.map((label, index) => (
          <span key={index}>{label}</span>
        ))}
      </div>
      <div className="mini-month-grid">
        {weeks.map((week, weekIndex) =>
          week.map((day, dayIndex) => {
            if (day === null) {
              return <span key={`${weekIndex}-${dayIndex}`} className="mini-day empty" />;
            }

            const key = dateKey(year, month, day);
            const summary = summaryByDate[key];
            const isToday = key === todayKey;
            const outcome = summary?.hasPnl ? (summary.pnl >= 0 ? 'bullish' : 'bearish') : '';

            return (
              <button
                key={`${weekIndex}-${dayIndex}`}
                type="button"
                className={`mini-day ${outcome} ${isToday ? 'today' : ''}`}
                onClick={() => onDayClick(key)}
                title={summary ? `${summary.count} trade${summary.count === 1 ? '' : 's'}` : undefined}
              >
                {day}
              </button>
            );
          }),
        )}
      </div>
    </div>
  );
}

export default MiniMonth;
