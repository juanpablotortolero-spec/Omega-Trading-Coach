import { buildWeeks, dateKey, formatMoney, weekdayLabels, type DaySummary } from '../lib/calendar';

function MonthCalendar({
  year,
  month,
  summaryByDate,
  todayKey,
  onDayClick,
}: {
  year: number;
  month: number;
  summaryByDate: Record<string, DaySummary>;
  todayKey: string;
  onDayClick: (key: string) => void;
}) {
  const weeks = buildWeeks(year, month);

  return (
    <div className="historial-grid">
      {weekdayLabels.map((label) => (
        <span className="historial-label" key={label}>
          {label}
        </span>
      ))}
      <span className="historial-label historial-total-label">TOTAL</span>

      {weeks.map((week, weekIndex) => {
        const weekTotal = week.reduce<number>((sum, day) => {
          if (day === null) return sum;
          const summary = summaryByDate[dateKey(year, month, day)];
          return sum + (summary?.hasPnl ? summary.pnl : 0);
        }, 0);
        const hasAnyValue = week.some((day) => {
          if (day === null) return false;
          return summaryByDate[dateKey(year, month, day)]?.hasPnl;
        });

        return (
          <div className="historial-week" key={weekIndex}>
            {week.map((day, dayIndex) => {
              if (day === null) {
                return <span key={dayIndex} className="historial-cell empty" />;
              }
              const key = dateKey(year, month, day);
              const summary = summaryByDate[key];
              const isToday = key === todayKey;

              return (
                <button
                  key={dayIndex}
                  type="button"
                  className={`historial-cell ${isToday ? 'today' : ''}`}
                  onClick={() => onDayClick(key)}
                >
                  <span className="historial-day-number">{day}</span>
                  {summary && (
                    <div className="historial-cell-data">
                      {summary.hasPnl && (
                        <span className={`historial-pnl ${summary.pnl >= 0 ? 'bullish' : 'bearish'}`}>
                          {formatMoney(summary.pnl)}
                        </span>
                      )}
                      <span className="historial-trade-count">
                        {summary.count} {summary.count === 1 ? 'trade' : 'trades'}
                      </span>
                      {summary.models.length > 0 && (
                        <span className="historial-model" title={summary.models.join(', ')}>
                          {summary.models[0]}
                          {summary.models.length > 1 ? ` +${summary.models.length - 1}` : ''}
                        </span>
                      )}
                    </div>
                  )}
                </button>
              );
            })}
            <div className={`historial-total ${hasAnyValue ? (weekTotal >= 0 ? 'bullish' : 'bearish') : ''}`}>
              <span className="historial-total-label-inline">Semana</span>
              <span className="historial-total-value">{hasAnyValue ? formatMoney(weekTotal) : '—'}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default MonthCalendar;
