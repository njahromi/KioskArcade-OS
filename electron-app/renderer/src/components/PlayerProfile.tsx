import React, { useState } from 'react';
import { useQuery, useQueryClient } from 'react-query';
import toast from 'react-hot-toast';
import { UserPlus, QrCode, LogOut } from 'lucide-react';

const PlayerProfile: React.FC = () => {
  const queryClient = useQueryClient();
  const [displayName, setDisplayName] = useState('');
  const [pin, setPin] = useState('');
  const [qrPayload, setQrPayload] = useState('');
  const [activeProfile, setActiveProfile] = useState<{
    id: string;
    displayName: string;
    qrPayload: string;
    personalBests: Record<string, number>;
    achievementIds: string[];
  } | null>(null);

  const { data: achievements = [] } = useQuery({
    queryKey: ['achievements'],
    queryFn: () => window.electronAPI.achievements.list()
  });

  const { data: unlocks = [] } = useQuery({
    queryKey: ['achievementUnlocks', activeProfile?.id],
    queryFn: () => window.electronAPI.achievements.unlocks(activeProfile?.id),
    enabled: !!activeProfile?.id
  });

  const create = async () => {
    const profile = await window.electronAPI.player.create(displayName || 'Player', pin || undefined);
    await window.electronAPI.player.identify({ playerId: profile.id, pin: pin || undefined });
    setActiveProfile(profile);
    toast.success(`Profile created. QR: ${profile.qrPayload}`);
    void queryClient.invalidateQueries({ queryKey: ['competitionDisplayName'] });
  };

  const identify = async () => {
    const profile = await window.electronAPI.player.identify({
      qrPayload: qrPayload.trim(),
      pin: pin || undefined
    });
    if (!profile) {
      toast.error('Could not identify player (check QR / PIN)');
      return;
    }
    setActiveProfile(profile);
    toast.success(`Welcome back, ${profile.displayName}`);
    void queryClient.invalidateQueries({ queryKey: ['competitionDisplayName'] });
  };

  const clear = async () => {
    await window.electronAPI.player.clear();
    setActiveProfile(null);
    toast.success('Signed out of player profile');
  };

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 space-y-4">
      <h3 className="text-white font-semibold flex items-center gap-2">
        <QrCode size={18} />
        Player identity
      </h3>
      {activeProfile ? (
        <div className="space-y-2 text-sm">
          <p className="text-emerald-300">
            Signed in as <strong>{activeProfile.displayName}</strong>
          </p>
          <p className="text-gray-400 font-mono text-xs break-all">{activeProfile.qrPayload}</p>
          {Object.keys(activeProfile.personalBests || {}).length > 0 && (
            <ul className="text-gray-300">
              {Object.entries(activeProfile.personalBests).map(([game, score]) => (
                <li key={game}>
                  {game}: {score}
                </li>
              ))}
            </ul>
          )}
          {unlocks.length > 0 && (
            <div>
              <p className="text-gray-400 mb-1">Achievements</p>
              <ul className="text-amber-200 text-xs space-y-1">
                {unlocks.map((u: { achievementId: string }) => {
                  const def = achievements.find((a: { id: string }) => a.id === u.achievementId);
                  return <li key={u.achievementId}>{def?.name ?? u.achievementId}</li>;
                })}
              </ul>
            </div>
          )}
          <button
            type="button"
            onClick={() => void clear()}
            className="inline-flex items-center gap-1 text-gray-400 hover:text-white text-xs"
          >
            <LogOut size={14} />
            Sign out
          </button>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-xs text-gray-300">
            Display name
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="mt-1 w-full rounded bg-gray-900 border border-gray-600 px-2 py-1.5 text-white text-sm"
            />
          </label>
          <label className="text-xs text-gray-300">
            Optional PIN
            <input
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              type="password"
              className="mt-1 w-full rounded bg-gray-900 border border-gray-600 px-2 py-1.5 text-white text-sm"
            />
          </label>
          <label className="text-xs text-gray-300 sm:col-span-2">
            Or paste QR payload
            <input
              value={qrPayload}
              onChange={(e) => setQrPayload(e.target.value)}
              placeholder="kioskarcade:player:…"
              className="mt-1 w-full rounded bg-gray-900 border border-gray-600 px-2 py-1.5 text-white text-sm font-mono"
            />
          </label>
          <button
            type="button"
            onClick={() => void create()}
            className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded bg-blue-600 hover:bg-blue-500 text-white text-sm"
          >
            <UserPlus size={16} />
            Create profile
          </button>
          <button
            type="button"
            onClick={() => void identify()}
            className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded bg-slate-600 hover:bg-slate-500 text-white text-sm"
          >
            <QrCode size={16} />
            Identify
          </button>
        </div>
      )}
    </div>
  );
};

export default PlayerProfile;
