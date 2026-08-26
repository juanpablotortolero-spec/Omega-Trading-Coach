export type DailyMissionItem = {
  id: string;
  label: string;
  rewardXp: number;
};

function DailyMissions({ missions }: { missions: DailyMissionItem[] }) {
  return (
    <div className="daily-missions-list">
      {missions.map((mission) => (
        <div key={mission.id} className="daily-mission-row">
          <span className="daily-mission-label">{mission.label}</span>
          <span className="daily-mission-xp">+{mission.rewardXp} XP</span>
        </div>
      ))}
    </div>
  );
}

export default DailyMissions;
