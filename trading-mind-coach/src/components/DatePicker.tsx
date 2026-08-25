import { useState } from 'react';
import { buildWeeks, dateKey, localIsoDate } from '../lib/calendar';

const shortWeekdayLabels = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

const monthNames = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];

function parseIso(value: string): { year: number; month: number; day: number } {
  const [year, month, day] = value.split('-').map(Number);
  return { year, month: month - 1, day };
}

function formatLabel(value: string): string {
  if (!value) return 'Elegir fecha';
  const { year, month, day } = parseIso(value);
  return `${day} de ${monthNames[month]}, ${year}`;
}

function DatePicker({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const [open, setOpen] = useState(false);
  const initial = value ? parseIso(value) : parseIso(localIsoDate(new Date()));
  const [viewYear, setViewYear] = useState(initial.year);
  const [viewMonth, setViewMonth] = useState(initial.month);

  const todayKey = localIsoDate(new Date());
  const weeks = buildWeeks(viewYear, viewMonth);

  const goToMonth = (delta: number) => {
    const next = new Date(viewYear, viewMonth + delta, 1);
    setViewYear(next.getFullYear());
    setViewMonth(next.getMonth());
  };

  const openPicker = () => {
    if (value) {
      const parsed = parseIso(value);
      setViewYear(parsed.year);
      setViewMonth(parsed.month);
    }
    setOpen((current) => !current);
  };

  return (
    <div className="date-picker">
      <button type="button" className="date-picker-trigger" onClick={openPicker}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="date-picker-icon" aria-hidden="true">
          <rect x="3" y="5" width="18" height="16" rx="2" />
          <path d="M3 10h18" />
          <path d="M8 3v4M16 3v4" />
        </svg>
        {formatLabel(value)}
      </button>

      {open && (
        <div className="date-picker-panel">
          <div className="date-picker-nav">
            <button type="button" className="icon-btn" onClick={() => goToMonth(-1)} aria-label="Mes anterior">
              ‹
            </button>
            <span className="date-picker-title">
              {monthNames[viewMonth]} {viewYear}
            </span>
            <button type="button" className="icon-btn" onClick={() => goToMonth(1)} aria-label="Mes siguiente">
              ›
            </button>
          </div>

          <div className="date-picker-weekdays">
            {shortWeekdayLabels.map((label, index) => (
              <span key={index}>{label}</span>
            ))}
          </div>

          <div className="date-picker-grid">
            {weeks.map((week, weekIndex) =>
              week.map((day, dayIndex) => {
                if (day === null) {
                  return <span key={`${weekIndex}-${dayIndex}`} className="date-picker-day empty" />;
                }
                const key = dateKey(viewYear, viewMonth, day);
                return (
                  <button
                    key={`${weekIndex}-${dayIndex}`}
                    type="button"
                    className={`date-picker-day ${key === todayKey ? 'today' : ''} ${key === value ? 'selected' : ''}`}
                    onClick={() => {
                      onChange(key);
                      setOpen(false);
                    }}
                  >
                    {day}
                  </button>
                );
              }),
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default DatePicker;
