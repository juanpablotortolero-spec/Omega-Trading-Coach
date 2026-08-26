import { useEffect, useState } from 'react';
import MedalBadge from '../components/MedalBadge';
import OmegaMark from '../components/OmegaMark';
import { useAuth } from '../contexts/AuthContext';
import {
  coreDailyMissionDefinitions,
  getCoreMissionCompletionCounts,
  getWeeklyMissionCompletionCounts,
  weeklyMissionDefinitions,
  type MissionCompletionCounts,
} from '../lib/api';
import { getMedalProgress } from '../lib/medals';

type MissionMedalCardProps = {
  label: string;
  totalCompletions: number;
};

function MissionMedalCard({ label, totalCompletions }: MissionMedalCardProps) {
  const progress = getMedalProgress(totalCompletions);
  const pct = progress.neededForNext ? Math.round((progress.countInTier / progress.neededForNext) * 100) : 100;

  return (
    <div className="panel medal-card">
      <MedalBadge tier={progress.tierName} size={52} />
      <span className="medal-card-title">{label}</span>
      <span className="medal-card-tier">
        {progress.tierName ? progress.tierName : 'Sin medalla todavía'}
        {progress.maxed && ' (máxima)'}
      </span>
      <div className="gauge-wrap medal-card-progress">
        <span className="gauge-fill" style={{ width: `${pct}%` }} />
      </div>
      <span className="medal-card-count">
        {progress.maxed
          ? `${totalCompletions} cumplimientos en total`
          : `${progress.countInTier}/${progress.neededForNext} hacia ${progress.nextTierName}`}
      </span>
    </div>
  );
}

function Logros() {
  const { user } = useAuth();
  const [dailyCounts, setDailyCounts] = useState<MissionCompletionCounts>({});
  const [weeklyCounts, setWeeklyCounts] = useState<MissionCompletionCounts>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    Promise.all([getCoreMissionCompletionCounts(user.id), getWeeklyMissionCompletionCounts(user.id)]).then(
      ([daily, weekly]) => {
        if (cancelled) return;
        setDailyCounts(daily);
        setWeeklyCounts(weekly);
        setLoading(false);
      },
    );

    return () => {
      cancelled = true;
    };
  }, [user]);

  return (
    <div className="omega-hq">
      <header className="omega-hq-header">
        <OmegaMark size={40} />
        <div className="omega-hq-header-copy">
          <h2>Museo de Medallas</h2>
          <p className="hint-text">Cuántas veces cumpliste cada misión, verificado contra tus datos reales.</p>
        </div>
      </header>

      {loading ? (
        <div className="skeleton skeleton-table" />
      ) : (
        <>
          <section className="panel plan-section">
            <div className="section-header">
              <h3>Misiones diarias</h3>
            </div>
            <div className="stats-preview-grid">
              {coreDailyMissionDefinitions.map((mission) => (
                <MissionMedalCard key={mission.key} label={mission.label} totalCompletions={dailyCounts[mission.key] ?? 0} />
              ))}
            </div>
          </section>

          <section className="panel plan-section">
            <div className="section-header">
              <h3>Misiones semanales</h3>
            </div>
            <div className="stats-preview-grid">
              {weeklyMissionDefinitions.map((mission) => (
                <MissionMedalCard key={mission.key} label={mission.label} totalCompletions={weeklyCounts[mission.key] ?? 0} />
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}

export default Logros;
