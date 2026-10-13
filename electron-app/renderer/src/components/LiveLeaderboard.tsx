import React from 'react';
import { useQuery } from 'react-query';
import { Trophy, Clock } from 'lucide-react';

interface LiveLeaderboardProps {
  readonly competitionId?: string | null;
  readonly compact?: boolean;
}

const LiveLeaderboard: React.FC<LiveLeaderboardProps> = ({ competitionId, compact = false }) => {
  const { data: active } = useQuery({
    queryKey: ['competitionActive'],
    queryFn: () => window.electronAPI.competition.getActive(),
    refetchInterval: 10_000,
    enabled: !competitionId
  });

  const resolvedId = competitionId ?? active?.id ?? null;

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ['leaderboard', resolvedId],
    queryFn: () => window.electronAPI.competition.getLeaderboard(resolvedId as string, 10),
    enabled: !!resolvedId,
    refetchInterval: 5_000
  });

  if (!resolvedId) {
    return (
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 text-gray-400 text-sm">
        No active competition. Staff can start one from Admin.
      </div>
    );
  }

  const endsAt = active?.endsAt ? Date.parse(active.endsAt) : null;
  const remainingMs = endsAt && Number.isFinite(endsAt) ? Math.max(0, endsAt - Date.now()) : null;
  const remainingLabel =
    remainingMs === null
      ? null
      : remainingMs < 60_000
        ? `${Math.ceil(remainingMs / 1000)}s left`
        : `${Math.ceil(remainingMs / 60_000)}m left`;

  return (
    <div className={`bg-gray-800 border border-gray-700 rounded-lg ${compact ? 'p-3' : 'p-5'}`}>
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <Trophy size={18} className="text-amber-400" />
          <h3 className={`font-semibold text-white ${compact ? 'text-base' : 'text-lg'}`}>
            {active?.name ?? 'Leaderboard'}
          </h3>
        </div>
        {remainingLabel && (
          <span className="inline-flex items-center gap-1 text-xs text-slate-300">
            <Clock size={14} />
            {remainingLabel}
          </span>
        )}
      </div>
      {active?.gameId && (
        <p className="text-xs text-gray-400 mb-3 font-mono">{active.gameId}</p>
      )}
      {isLoading ? (
        <p className="text-sm text-gray-400">Loading rankings…</p>
      ) : entries.length === 0 ? (
        <p className="text-sm text-gray-400">No scores yet — be the first on the board.</p>
      ) : (
        <ol className="space-y-2">
          {entries.map((entry: {
            rank: number;
            displayName: string;
            score: number;
            validation: string;
          }) => (
            <li
              key={`${entry.rank}-${entry.displayName}`}
              className="flex items-center justify-between text-sm bg-gray-900/60 rounded px-3 py-2"
            >
              <span className="text-gray-300">
                <span className="text-amber-300 font-mono mr-2">#{entry.rank}</span>
                {entry.displayName}
                {entry.validation === 'flagged' && (
                  <span className="ml-2 text-xs text-amber-500">review</span>
                )}
              </span>
              <span className="font-mono text-white">{entry.score}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
};

export default LiveLeaderboard;
