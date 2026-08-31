import { currentStage, stageBadges } from '../lib/virtus';

function clampPct(value: number) {
  return Math.min(100, Math.max(0, value));
}

function VirtusProgressBar({
  virtusTotal,
  todayDelta,
  peakTotal,
}: {
  virtusTotal: number;
  todayDelta: number;
  peakTotal: number;
}) {
  const stage = currentStage(virtusTotal);
  const nextStage = stageBadges[stageBadges.indexOf(stage) + 1];
  const tierSpan = nextStage ? nextStage.minPoints - stage.minPoints : 1;

  const currentPct = nextStage ? clampPct(((virtusTotal - stage.minPoints) / tierSpan) * 100) : 100;
  const peakPct = nextStage ? clampPct(((peakTotal - stage.minPoints) / tierSpan) * 100) : 100;
  const showPeak = peakTotal > virtusTotal;

  return (
    <div className="xp-bar-block">
      <div className="gauge-wrap xp-gauge-wrap">
        {todayDelta !== 0 && (
          <span className={`xp-delta-badge ${todayDelta > 0 ? 'positive' : 'negative'}`}>
            {todayDelta > 0 ? '▲' : '▼'} {todayDelta > 0 ? '+' : ''}
            {todayDelta.toLocaleString('es-ES')}
          </span>
        )}
        {showPeak && (
          <span
            className="gauge-peak-marker"
            style={{ left: `${peakPct}%` }}
            title={`Máximo alcanzado: ${peakTotal.toLocaleString('es-ES')} XP`}
          />
        )}
        <span className="gauge-fill" style={{ width: `${currentPct}%` }} />
        <span className="gauge-current-knob" style={{ left: `${currentPct}%` }}>
          <span className="gauge-knob-tooltip">{virtusTotal.toLocaleString('es-ES')} XP</span>
        </span>
      </div>
      <div className="xp-bounds-row">
        <span>{stage.minPoints.toLocaleString('es-ES')}</span>
        <span>{nextStage ? nextStage.minPoints.toLocaleString('es-ES') : 'MAX'}</span>
      </div>
      <div className="xp-detail-row">
        <span className="xp-current">{virtusTotal.toLocaleString('es-ES')} XP</span>
      </div>
    </div>
  );
}

export default VirtusProgressBar;
