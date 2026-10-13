import React from 'react';
import { useQuery } from 'react-query';
import { Medal } from 'lucide-react';

const SeasonPanel: React.FC = () => {
  const { data: active } = useQuery({
    queryKey: ['activeSeason'],
    queryFn: () => window.electronAPI.season.getActive(),
    refetchInterval: 30_000
  });

  const { data: standings = [] } = useQuery({
    queryKey: ['seasonStandings', active?.id],
    queryFn: () => window.electronAPI.season.standings(active.id),
    enabled: !!active?.id,
    refetchInterval: 15_000
  });

  const { data: brackets = [] } = useQuery({
    queryKey: ['brackets'],
    queryFn: () => window.electronAPI.bracket.list(),
    refetchInterval: 20_000
  });

  if (!active && brackets.length === 0) {
    return (
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 text-sm text-gray-400">
        No active season or brackets yet. Staff can start a season from Admin.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {active && (
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
          <h3 className="text-white font-semibold flex items-center gap-2 mb-1">
            <Medal size={18} className="text-yellow-400" />
            {active.name}
          </h3>
          <p className="text-xs text-gray-400 mb-3">{active.description || 'Season standings'}</p>
          {standings.length === 0 ? (
            <p className="text-sm text-gray-500">Compete in season events to earn points.</p>
          ) : (
            <ol className="space-y-1.5 text-sm">
              {standings.slice(0, 10).map(
                (row: {
                  rank: number;
                  displayName: string;
                  points: number;
                  competitionsPlayed: number;
                }) => (
                  <li
                    key={`${row.rank}-${row.displayName}`}
                    className="flex justify-between bg-gray-900/50 rounded px-3 py-1.5"
                  >
                    <span className="text-gray-200">
                      <span className="text-yellow-300 font-mono mr-2">#{row.rank}</span>
                      {row.displayName}
                      <span className="text-gray-500 text-xs ml-2">{row.competitionsPlayed} events</span>
                    </span>
                    <span className="font-mono text-white">{row.points} pts</span>
                  </li>
                )
              )}
            </ol>
          )}
        </div>
      )}

      {brackets.length > 0 && (
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
          <h3 className="text-white font-semibold mb-3">Elimination brackets</h3>
          <ul className="space-y-2 text-sm">
            {brackets.slice(0, 5).map(
              (b: { id: string; name: string; size: number; championName: string | null }) => (
                <li key={b.id} className="bg-gray-900/50 rounded px-3 py-2">
                  <div className="text-white font-medium">{b.name}</div>
                  <div className="text-xs text-gray-400">
                    {b.size}-player
                    {b.championName ? (
                      <span className="text-amber-300 ml-2">Champion: {b.championName}</span>
                    ) : (
                      <span className="ml-2">In progress</span>
                    )}
                  </div>
                </li>
              )
            )}
          </ul>
        </div>
      )}
    </div>
  );
};

export default SeasonPanel;
