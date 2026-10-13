import React, { useState } from 'react';
import { useQuery, useQueryClient } from 'react-query';
import toast from 'react-hot-toast';
import LiveLeaderboard from './LiveLeaderboard';
import PlayerProfile from './PlayerProfile';
import AchievementPanel from './AchievementPanel';

interface TournamentBrowserProps {
  readonly onLaunchGame: (gameId: string) => void;
}

const TournamentBrowser: React.FC<TournamentBrowserProps> = ({ onLaunchGame }) => {
  const queryClient = useQueryClient();
  const [displayName, setDisplayName] = useState('');
  const [showHub, setShowHub] = useState(false);

  const { data: active } = useQuery({
    queryKey: ['competitionActive'],
    queryFn: () => window.electronAPI.competition.getActive(),
    refetchInterval: 10_000
  });

  const { data: savedName } = useQuery({
    queryKey: ['competitionDisplayName'],
    queryFn: () => window.electronAPI.competition.getDisplayName()
  });

  const { data: session } = useQuery({
    queryKey: ['playerSession'],
    queryFn: () => window.electronAPI.player.getSession(),
    refetchInterval: 15_000
  });

  const signedInName = session?.player?.displayName as string | undefined;

  const saveName = async () => {
    if (signedInName) {
      toast('Using your player profile name', { icon: '👤' });
      return;
    }
    const name = await window.electronAPI.competition.setDisplayName(displayName || savedName || 'Player');
    toast.success(`Playing as ${name}`);
    void queryClient.invalidateQueries({ queryKey: ['competitionDisplayName'] });
  };

  return (
    <div className="mb-6 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-white">Competition Hub</h3>
          <p className="text-sm text-gray-400">
            {active
              ? `Live: ${active.name} (${active.gameId})`
              : 'No active event — play for fun or ask staff to start one'}
            {signedInName ? ` · Signed in as ${signedInName}` : ''}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowHub((v) => !v)}
          className="px-4 py-2 rounded bg-amber-700 hover:bg-amber-600 text-white text-sm font-medium"
        >
          {showHub ? 'Hide hub' : 'Players & standings'}
        </button>
      </div>

      {active && (
        <div className="flex flex-wrap gap-2 items-end">
          {!signedInName && (
            <>
              <label className="text-xs text-gray-300">
                Guest display name
                <input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder={savedName || 'Player'}
                  className="mt-1 block rounded bg-gray-800 border border-gray-600 px-3 py-2 text-white text-sm min-w-[160px]"
                />
              </label>
              <button
                type="button"
                onClick={() => void saveName()}
                className="px-3 py-2 rounded bg-gray-700 hover:bg-gray-600 text-white text-sm"
              >
                Save name
              </button>
            </>
          )}
          <button
            type="button"
            onClick={() => onLaunchGame(active.gameId)}
            className="px-3 py-2 rounded bg-blue-600 hover:bg-blue-500 text-white text-sm"
          >
            Play {active.gameId}
          </button>
        </div>
      )}

      {showHub && (
        <div className="grid gap-4 lg:grid-cols-2">
          <LiveLeaderboard />
          <div className="space-y-4">
            <PlayerProfile />
            <AchievementPanel />
          </div>
        </div>
      )}
    </div>
  );
};

export default TournamentBrowser;
