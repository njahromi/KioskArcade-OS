import React from 'react';
import { useQuery } from 'react-query';
import { BarChart3 } from 'lucide-react';

const CompetitionAnalyticsPanel: React.FC = () => {
  const { data: summary, isLoading } = useQuery({
    queryKey: ['competitionEngagement'],
    queryFn: () => window.electronAPI.competition.engagement(),
    refetchInterval: 20_000
  });

  if (isLoading || !summary) {
    return (
      <div className="bg-gray-800 rounded-lg p-6 border border-gray-700 text-gray-400 text-sm">
        Loading engagement metrics…
      </div>
    );
  }

  const stats: Array<{ label: string; value: number }> = [
    { label: 'Competitions created', value: summary.competitionsCreated },
    { label: 'Competitions ended', value: summary.competitionsEnded },
    { label: 'Scores submitted', value: summary.scoresSubmitted },
    { label: 'Flagged scores', value: summary.scoresFlagged },
    { label: 'Unique players (names)', value: summary.uniqueDisplayNames },
    { label: 'Profiles created', value: summary.playerProfilesCreated },
    { label: 'Sign-ins', value: summary.playerIdentifications },
    { label: 'Rewards created', value: summary.rewardsCreated },
    { label: 'Redemptions', value: summary.redemptionsRequested },
    { label: 'Approved redemptions', value: summary.redemptionsApproved },
    { label: 'Achievements unlocked', value: summary.achievementsUnlocked },
    { label: 'Sync runs', value: summary.syncRuns }
  ];

  return (
    <div className="bg-gray-800 rounded-lg p-6 border border-gray-700 space-y-4">
      <h3 className="text-lg font-semibold text-white flex items-center gap-2">
        <BarChart3 size={18} className="text-cyan-400" />
        Engagement analytics
      </h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {stats.map((s) => (
          <div key={s.label} className="bg-gray-900/60 rounded px-3 py-2">
            <div className="text-xl font-mono text-white">{s.value}</div>
            <div className="text-[11px] text-gray-400">{s.label}</div>
          </div>
        ))}
      </div>
      {summary.participationByGame?.length > 0 && (
        <div>
          <p className="text-sm text-gray-300 mb-2">Participation by game</p>
          <ul className="space-y-1 text-sm">
            {summary.participationByGame.map((g: { gameId: string; submissions: number }) => (
              <li
                key={g.gameId}
                className="flex justify-between bg-gray-900/40 rounded px-3 py-1.5 text-gray-200"
              >
                <span className="font-mono">{g.gameId}</span>
                <span>{g.submissions} scores</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default CompetitionAnalyticsPanel;
