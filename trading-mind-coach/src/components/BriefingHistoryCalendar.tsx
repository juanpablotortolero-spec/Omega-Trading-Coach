import { useEffect, useState } from 'react';
import { getBriefingByDate, getBriefingDatesInRange } from '../lib/api';
import { buildWeeks, dateKey, weekdayLabels } from '../lib/calendar';

/**
 * Calendario de briefings pasados — MISMO look que el calendario de
 * Historial (reutiliza sus clases historial-* y calendar-nav): los días con
 * briefing guardado se pintan dorados por completo (no un punto), y la
 * columna que en Historial muestra el total P&L de la semana acá es el
 * botón de Auditoría Semanal de esa fila — habilitado solo cuando esa
 * semana ya cerró (su viernes ya pasó o es hoy). Debajo del grid, la
 * Auditoría Mensual aparece como sorpresa: solo cuando el MES que se está
 * mirando ya terminó por completo.
 */
function BriefingHistoryCalendar({
  userId,
  onGenerateWeeklyAudit,
  generatingWeekKey,
  onGenerateMonthlyClose,
  monthlyGenerating,
}: {
  userId: string;
  onGenerateWeeklyAudit: (weekMonday: Date) => void;
  generatingWeekKey: string | null;
  onGenerateMonthlyClose: (monthStart: string, monthEnd: string) => void;
  monthlyGenerating: boolean;
}) {
  const today = new Date();
  const todayKey = dateKey(today.getFullYear(), today.getMonth(), today.getDate());
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [datesWithBriefing, setDatesWithBriefing] = useState<Set<string>>(new Set());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedContent, setSelectedContent] = useState<string | null>(null);
  const [loadingContent, setLoadingContent] = useState(false);

  const monthStart = dateKey(year, month, 1);
  const lastDay = new Date(year, month + 1, 0).getDate();
  const monthEnd = dateKey(year, month, lastDay);
  const monthHasEnded = monthEnd < todayKey;

  useEffect(() => {
    let cancelled = false;

    getBriefingDatesInRange(userId, monthStart, monthEnd).then((dates) => {
      if (!cancelled) setDatesWithBriefing(new Set(dates));
    });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, year, month]);

  const weeks = buildWeeks(year, month);
  const monthLabel = new Date(year, month, 1).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });

  // Alineado a cómo buildWeeks arma las filas: el lunes de la semana que
  // contiene el día 1 del mes, aunque ese lunes caiga en el mes anterior —
  // así el botón de cada fila apunta a la semana calendario real, no solo a
  // los días visibles de ESTE mes.
  const firstOfMonth = new Date(year, month, 1);
  const mondayIndexOfFirst = (firstOfMonth.getDay() + 6) % 7;
  const gridStart = new Date(year, month, 1 - mondayIndexOfFirst);

  const handleDayClick = async (day: number) => {
    const key = dateKey(year, month, day);
    if (!datesWithBriefing.has(key)) return;
    setSelectedDate(key);
    setSelectedContent(null);
    setLoadingContent(true);
    const content = await getBriefingByDate(userId, key);
    setSelectedContent(content);
    setLoadingContent(false);
  };

  const goPrevMonth = () => {
    if (month === 0) {
      setYear((y) => y - 1);
      setMonth(11);
    } else {
      setMonth((m) => m - 1);
    }
  };

  const goNextMonth = () => {
    if (month === 11) {
      setYear((y) => y + 1);
      setMonth(0);
    } else {
      setMonth((m) => m + 1);
    }
  };

  return (
    <div className="briefing-calendar">
      <h3 className="omega-calendar-title">Calendario de Briefings</h3>

      <div className="calendar-nav">
        <button type="button" className="icon-btn" onClick={goPrevMonth} aria-label="Mes anterior">
          ‹
        </button>
        <h3 style={{ textTransform: 'capitalize' }}>{monthLabel}</h3>
        <button type="button" className="icon-btn" onClick={goNextMonth} aria-label="Mes siguiente">
          ›
        </button>
      </div>

      <div className="historial-grid">
        {weekdayLabels.map((label) => (
          <span className="historial-label" key={label}>
            {label}
          </span>
        ))}
        <span className="historial-label historial-total-label">Auditoría</span>

        {weeks.map((week, weekIndex) => {
          const weekMonday = new Date(gridStart);
          weekMonday.setDate(gridStart.getDate() + weekIndex * 7);
          const weekFriday = new Date(weekMonday);
          weekFriday.setDate(weekMonday.getDate() + 4);
          weekFriday.setHours(0, 0, 0, 0);
          const todayAtMidnight = new Date(today);
          todayAtMidnight.setHours(0, 0, 0, 0);
          const weekClosed = weekFriday <= todayAtMidnight;
          const weekKey = dateKey(weekMonday.getFullYear(), weekMonday.getMonth(), weekMonday.getDate());
          const isGenerating = generatingWeekKey === weekKey;

          return (
            <div className="historial-week" key={weekIndex}>
              {week.map((day, dayIndex) => {
                if (day === null) return <span key={dayIndex} className="historial-cell empty" />;
                const key = dateKey(year, month, day);
                const hasBriefing = datesWithBriefing.has(key);
                const isToday = key === todayKey;

                return (
                  <button
                    key={dayIndex}
                    type="button"
                    className={`historial-cell ${isToday ? 'today' : ''} ${hasBriefing ? 'has-briefing' : ''}`}
                    onClick={() => handleDayClick(day)}
                    disabled={!hasBriefing}
                  >
                    <span className="historial-day-number">{day}</span>
                  </button>
                );
              })}

              <button
                type="button"
                className="historial-total-audit-btn"
                disabled={!weekClosed || isGenerating}
                onClick={() => onGenerateWeeklyAudit(weekMonday)}
                title={weekClosed ? 'Generar Auditoría Semanal de esta semana' : 'Se habilita el viernes, después de la sesión'}
              >
                <span className="historial-total-audit-icon" aria-hidden="true">
                  {weekClosed ? '⚖' : '🔒'}
                </span>
                <span className="historial-total-audit-label">{isGenerating ? 'Generando…' : 'Auditar'}</span>
              </button>
            </div>
          );
        })}
      </div>

      {monthHasEnded && (
        <div className="monthly-audit-reveal">
          <div className="monthly-audit-reveal-copy">
            <strong>Tu Auditoría Mensual de {monthLabel} está lista</strong>
            <p className="hint-text">El resumen y análisis más completo del mes: trades, setups, ejecución, evolución de Ataraxia y objetivos para el próximo mes.</p>
          </div>
          <button
            type="button"
            className="primary-btn btn-sm"
            disabled={monthlyGenerating}
            onClick={() => onGenerateMonthlyClose(monthStart, monthEnd)}
          >
            {monthlyGenerating ? 'Generando…' : 'Ver Auditoría Mensual'}
          </button>
        </div>
      )}

      {selectedDate && (
        <div className="info-modal-backdrop" onClick={() => setSelectedDate(null)}>
          <div className="info-modal-panel" onClick={(event) => event.stopPropagation()}>
            <div className="info-modal-header">
              <h3>Briefing del {selectedDate}</h3>
              <button type="button" className="icon-btn" onClick={() => setSelectedDate(null)} aria-label="Cerrar">
                ✕
              </button>
            </div>
            {loadingContent ? (
              <div className="skeleton skeleton-text" />
            ) : (
              <p className="omega-feedback-text">{selectedContent ?? 'No se pudo cargar este briefing.'}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default BriefingHistoryCalendar;
