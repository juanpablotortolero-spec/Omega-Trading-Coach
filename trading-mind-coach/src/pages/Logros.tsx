import { useEffect, useState } from 'react';
import MissionBadge from '../components/MissionBadge';
import OmegaMark from '../components/OmegaMark';
import { useAuth } from '../contexts/AuthContext';
import {
  coreDailyMissionDefinitions,
  getCoreMissionCompletionCounts,
  getPsychGrowthCounts,
  getTradingPlan,
  getWeeklyMissionCompletionCounts,
  OPERATOR_PSYCH_MISSION_KEYS,
  weeklyMissionDefinitions,
  type MissionCompletionCounts,
  type PsychGrowthCategory,
  type SetupItem,
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
      <MissionBadge tier={progress.tierName} size={84} />
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
  const [psychGrowthCounts, setPsychGrowthCounts] = useState<Record<PsychGrowthCategory, number>>({
    correccion: 0,
    fortaleza: 0,
  });
  const [setups, setSetups] = useState<SetupItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    Promise.all([
      getCoreMissionCompletionCounts(user.id),
      getWeeklyMissionCompletionCounts(user.id),
      getPsychGrowthCounts(user.id),
      getTradingPlan(user.id),
    ]).then(([daily, weekly, psych, plan]) => {
      if (cancelled) return;
      setDailyCounts(daily);
      setWeeklyCounts(weekly);
      setPsychGrowthCounts(psych);
      setSetups(plan?.setups.filter((setup) => setup.name.trim().length > 0) ?? []);
      setLoading(false);
    });

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

          <section className="panel plan-section">
            <div className="section-header">
              <h3>Misiones de Operador</h3>
              <span className="hint-text">verificadas contra tu journal, nunca por el resultado (P&L)</span>
            </div>
            {setups.length === 0 ? (
              <div className="empty-state">
                <span className="empty-icon" />
                <h3>Sin setups definidos</h3>
                <p>Define tus setups en el Manual Operativo para empezar a ganar estas medallas.</p>
              </div>
            ) : (
              <div className="stats-preview-grid">
                {setups.map((setup) => (
                  <MissionMedalCard
                    key={setup.id}
                    label={setup.name}
                    totalCompletions={dailyCounts[`setup:${setup.id}`] ?? 0}
                  />
                ))}
              </div>
            )}
            <div className="stats-preview-grid" style={{ marginTop: setups.length > 0 ? 16 : 0 }}>
              <MissionMedalCard
                label="Análisis cumplidos"
                totalCompletions={dailyCounts[OPERATOR_PSYCH_MISSION_KEYS.ANALYSIS_CORRECT] ?? 0}
              />
              <MissionMedalCard
                label="Manejo de riesgo"
                totalCompletions={dailyCounts[OPERATOR_PSYCH_MISSION_KEYS.RISK_MANAGEMENT_MISSION] ?? 0}
              />
            </div>
          </section>

          <section className="panel plan-section">
            <div className="section-header">
              <h3>Misiones Psicológicas</h3>
            </div>
            <div className="stats-preview-grid">
              <MissionMedalCard
                label="Respeto a mi análisis"
                totalCompletions={dailyCounts[OPERATOR_PSYCH_MISSION_KEYS.RESPECT_ANALYSIS] ?? 0}
              />
              <MissionMedalCard
                label="No tuve emociones negativas"
                totalCompletions={dailyCounts[OPERATOR_PSYCH_MISSION_KEYS.NO_NEGATIVE_EMOTIONS] ?? 0}
              />
              <MissionMedalCard
                label="Disciplina (Ataraxia 85-100%)"
                totalCompletions={dailyCounts[OPERATOR_PSYCH_MISSION_KEYS.DISCIPLINE_85] ?? 0}
              />
              <MissionMedalCard label="Corrección de errores" totalCompletions={psychGrowthCounts.correccion} />
              <MissionMedalCard label="Fortaleza" totalCompletions={psychGrowthCounts.fortaleza} />
            </div>
          </section>
        </>
      )}
    </div>
  );
}

export default Logros;
