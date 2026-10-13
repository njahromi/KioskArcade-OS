import React, { useEffect } from 'react';
import { useQuery, useQueryClient } from 'react-query';
import { Award, Lock, CheckCircle2 } from 'lucide-react';

interface ProgressRow {
  readonly achievementId: string;
  readonly name: string;
  readonly description: string;
  readonly gameId: string | '*';
  readonly unlocked: boolean;
  readonly unlockedAt: string | null;
  readonly progress: number;
  readonly currentValue: number;
  readonly targetValue: number;
}

const AchievementPanel: React.FC = () => {
  const queryClient = useQueryClient();

  const { data: session } = useQuery({
    queryKey: ['playerSession'],
    queryFn: () => window.electronAPI.player.getSession()
  });

  const playerId = session?.player?.id as string | undefined;

  const { data: catalog = [] } = useQuery({
    queryKey: ['achievements'],
    queryFn: () => window.electronAPI.achievements.list()
  });

  const { data: progress = [] } = useQuery({
    queryKey: ['achievementProgress', playerId],
    queryFn: () => window.electronAPI.achievements.progress(playerId),
    enabled: !!playerId,
    refetchInterval: 10_000
  });

  useEffect(() => {
    const off = window.electronAPI.achievements.onUnlocked?.(() => {
      void queryClient.invalidateQueries({ queryKey: ['achievementProgress'] });
      void queryClient.invalidateQueries({ queryKey: ['playerSession'] });
    });
    return () => off?.();
  }, [queryClient]);

  const rows: ProgressRow[] = playerId
    ? (progress as ProgressRow[])
    : (catalog as Array<{ id: string; name: string; description: string; gameId: string }>).map(
        (a) => ({
          achievementId: a.id,
          name: a.name,
          description: a.description,
          gameId: a.gameId,
          unlocked: false,
          unlockedAt: null,
          progress: 0,
          currentValue: 0,
          targetValue: 1
        })
      );

  const unlockedCount = rows.filter((r) => r.unlocked).length;

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-white font-semibold flex items-center gap-2">
          <Award size={18} className="text-amber-400" />
          Achievements
        </h3>
        {playerId && (
          <span className="text-xs text-gray-400">
            {unlockedCount}/{rows.length} unlocked
          </span>
        )}
      </div>

      {!playerId && (
        <p className="text-xs text-gray-400 mb-3">
          Sign in with a player profile to track progress and unlock achievements.
        </p>
      )}

      <ul className="space-y-2 text-sm max-h-72 overflow-y-auto pr-1">
        {rows.map((a) => (
          <li
            key={a.achievementId}
            className={`rounded px-3 py-2 border ${
              a.unlocked
                ? 'bg-amber-950/40 border-amber-800/50'
                : 'bg-gray-900/50 border-transparent'
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="text-white font-medium flex items-center gap-1.5">
                  {a.unlocked ? (
                    <CheckCircle2 size={14} className="text-amber-400 shrink-0" />
                  ) : (
                    <Lock size={14} className="text-gray-500 shrink-0" />
                  )}
                  {a.name}
                </div>
                <div className="text-gray-400 text-xs mt-0.5">
                  {a.gameId} — {a.description}
                </div>
              </div>
              {playerId && (
                <span className="text-[11px] font-mono text-gray-400 shrink-0">
                  {Math.min(a.currentValue, a.targetValue)}/{a.targetValue}
                </span>
              )}
            </div>
            {playerId && !a.unlocked && (
              <div className="mt-2 h-1.5 rounded bg-gray-700 overflow-hidden">
                <div
                  className="h-full bg-amber-500/80 transition-all"
                  style={{ width: `${Math.round(a.progress * 100)}%` }}
                />
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default AchievementPanel;
