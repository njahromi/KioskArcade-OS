import React, { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from 'react-query';
import { Building2, Clock, CalendarClock } from 'lucide-react';

function formatRemaining(ms: number | null): string {
  if (ms === null) return 'Open-ended';
  if (ms <= 0) return 'Ending…';
  const totalSec = Math.ceil(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  if (m >= 60) {
    const h = Math.floor(m / 60);
    return `${h}h ${m % 60}m left`;
  }
  return `${m}:${String(s).padStart(2, '0')} left`;
}

const VenueLeaderboard: React.FC = () => {
  const queryClient = useQueryClient();
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const { data: venue = [] } = useQuery({
    queryKey: ['venueLeaderboard'],
    queryFn: () => window.electronAPI.competition.venueLeaderboard(10),
    refetchInterval: 8_000
  });

  const { data: timers = [] } = useQuery({
    queryKey: ['eventTimers'],
    queryFn: () => window.electronAPI.competition.eventTimers(),
    refetchInterval: 5_000
  });

  const { data: upcoming = [] } = useQuery({
    queryKey: ['upcomingEvents'],
    queryFn: () => window.electronAPI.competition.upcoming(4),
    refetchInterval: 30_000
  });

  useEffect(() => {
    const offSpawn = window.electronAPI.competition.onEventSpawned?.(() => {
      void queryClient.invalidateQueries({ queryKey: ['competitionActive'] });
      void queryClient.invalidateQueries({ queryKey: ['eventTimers'] });
      void queryClient.invalidateQueries({ queryKey: ['competitions'] });
      void queryClient.invalidateQueries({ queryKey: ['upcomingEvents'] });
    });
    const offSync = window.electronAPI.competition.onSyncStatus?.(() => {
      void queryClient.invalidateQueries({ queryKey: ['venueLeaderboard'] });
      void queryClient.invalidateQueries({ queryKey: ['leaderboard'] });
    });
    return () => {
      offSpawn?.();
      offSync?.();
    };
  }, [queryClient]);

  return (
    <div className="space-y-4">
      {(timers as Array<{
        competitionId: string;
        name: string;
        gameId: string;
        remainingMs: number | null;
        endsAt: string | null;
        topScore: number | null;
        topPlayer: string | null;
      }>).length > 0 && (
        <div className="bg-indigo-950/40 border border-indigo-800/50 rounded-lg p-4">
          <h3 className="text-white font-semibold flex items-center gap-2 mb-3">
            <Clock size={18} className="text-indigo-300" />
            Live events
          </h3>
          <ul className="space-y-2">
            {timers.map((t) => {
              const remaining =
                t.remainingMs === null
                  ? null
                  : t.endsAt
                    ? Math.max(0, Date.parse(t.endsAt) - now)
                    : t.remainingMs;
              return (
                <li
                  key={t.competitionId}
                  className="flex flex-wrap items-center justify-between gap-2 text-sm bg-gray-900/40 rounded px-3 py-2"
                >
                  <div>
                    <div className="text-white font-medium">{t.name}</div>
                    <div className="text-xs text-gray-400 font-mono">
                      {t.gameId}
                      {t.topPlayer != null && (
                        <span className="ml-2 text-amber-300">
                          lead {t.topPlayer} · {t.topScore}
                        </span>
                      )}
                    </div>
                  </div>
                  <span className="font-mono text-indigo-200 text-xs">
                    {formatRemaining(remaining)}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
        <h3 className="text-white font-semibold flex items-center gap-2 mb-3">
          <Building2 size={18} className="text-emerald-400" />
          Venue-wide rankings
        </h3>
        {venue.length === 0 ? (
          <p className="text-sm text-gray-400">No venue scores yet. Sync cabinets or play locally.</p>
        ) : (
          <ol className="space-y-2">
            {venue.map(
              (entry: {
                rank: number;
                displayName: string;
                score: number;
                gameId: string;
                competitionName: string;
                arcadeId: string | null;
                submissionId: string;
              }) => (
                <li
                  key={entry.submissionId}
                  className="flex items-center justify-between text-sm bg-gray-900/60 rounded px-3 py-2"
                >
                  <span className="text-gray-300 min-w-0">
                    <span className="text-emerald-300 font-mono mr-2">#{entry.rank}</span>
                    {entry.displayName}
                    <span className="block text-[11px] text-gray-500 truncate">
                      {entry.gameId} · {entry.competitionName}
                      {entry.arcadeId ? ` · ${entry.arcadeId.slice(0, 8)}` : ''}
                    </span>
                  </span>
                  <span className="font-mono text-white shrink-0">{entry.score}</span>
                </li>
              )
            )}
          </ol>
        )}
      </div>

      {(upcoming as Array<{
        scheduleId: string;
        name: string;
        gameId: string;
        nextStartAt: string;
        cadence: string;
      }>).length > 0 && (
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
          <h3 className="text-white font-semibold flex items-center gap-2 mb-3">
            <CalendarClock size={18} className="text-slate-300" />
            Upcoming
          </h3>
          <ul className="space-y-2 text-sm">
            {upcoming.map((u) => (
              <li
                key={u.scheduleId}
                className="flex justify-between gap-2 bg-gray-900/50 rounded px-3 py-2"
              >
                <span className="text-gray-200">
                  {u.name}
                  <span className="text-gray-500 ml-2 font-mono text-xs">{u.gameId}</span>
                </span>
                <span className="text-xs text-gray-400 font-mono shrink-0">
                  {new Date(u.nextStartAt).toLocaleString(undefined, {
                    weekday: 'short',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default VenueLeaderboard;
