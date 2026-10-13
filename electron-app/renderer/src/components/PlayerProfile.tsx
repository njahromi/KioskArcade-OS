import React, { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from 'react-query';
import toast from 'react-hot-toast';
import { UserPlus, QrCode, LogOut, Copy, Shield } from 'lucide-react';

interface PublicProfile {
  readonly id: string;
  readonly displayName: string;
  readonly hasPin: boolean;
  readonly qrPayload: string;
  readonly personalBests: Record<string, number>;
  readonly achievementIds: readonly string[];
  readonly tournamentHistory: readonly string[];
}

const PlayerProfile: React.FC = () => {
  const queryClient = useQueryClient();
  const [displayName, setDisplayName] = useState('');
  const [pin, setPin] = useState('');
  const [qrPayload, setQrPayload] = useState('');
  const [mode, setMode] = useState<'create' | 'identify'>('create');

  const { data: session } = useQuery({
    queryKey: ['playerSession'],
    queryFn: () => window.electronAPI.player.getSession(),
    refetchInterval: 15_000
  });

  const activeProfile = (session?.player as PublicProfile | null) ?? null;

  const { data: qrDataUrl } = useQuery({
    queryKey: ['playerQr', activeProfile?.id],
    queryFn: () => window.electronAPI.player.qrDataUrl(activeProfile?.id),
    enabled: !!activeProfile?.id
  });

  useEffect(() => {
    const off = window.electronAPI.competition.onScoreSubmitted?.(() => {
      void queryClient.invalidateQueries({ queryKey: ['playerSession'] });
      void queryClient.invalidateQueries({ queryKey: ['achievementProgress'] });
    });
    return () => off?.();
  }, [queryClient]);

  const refreshSession = () => {
    void queryClient.invalidateQueries({ queryKey: ['playerSession'] });
    void queryClient.invalidateQueries({ queryKey: ['competitionDisplayName'] });
    void queryClient.invalidateQueries({ queryKey: ['achievementProgress'] });
    void queryClient.invalidateQueries({ queryKey: ['playerQr'] });
  };

  const create = async () => {
    const result = await window.electronAPI.player.create(displayName || 'Player', pin || undefined);
    if (!result.ok) {
      toast.error(result.reason || 'Could not create profile');
      return;
    }
    setPin('');
    toast.success(`Welcome, ${result.profile.displayName}! Save your QR for next visit.`);
    refreshSession();
  };

  const identify = async () => {
    if (!qrPayload.trim()) {
      toast.error('Paste your player QR code text');
      return;
    }
    const result = await window.electronAPI.player.identify({
      qrPayload: qrPayload.trim(),
      pin: pin || undefined
    });
    if (!result.ok) {
      if (result.reason === 'pin_required') {
        toast.error('This profile needs a PIN');
      } else if (result.reason === 'not_found') {
        toast.error('Player not found');
      } else {
        toast.error('Could not sign in');
      }
      return;
    }
    setPin('');
    setQrPayload('');
    toast.success(`Welcome back, ${result.profile.displayName}`);
    refreshSession();
  };

  const clear = async () => {
    await window.electronAPI.player.clear();
    toast.success('Signed out');
    refreshSession();
  };

  const copyQr = async () => {
    if (!activeProfile) return;
    try {
      await navigator.clipboard.writeText(activeProfile.qrPayload);
      toast.success('QR payload copied');
    } catch {
      toast.error('Could not copy');
    }
  };

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 space-y-4">
      <h3 className="text-white font-semibold flex items-center gap-2">
        <QrCode size={18} />
        Player identity
      </h3>

      {activeProfile ? (
        <div className="space-y-3 text-sm">
          <div className="flex flex-wrap gap-4 items-start">
            {qrDataUrl && (
              <img
                src={qrDataUrl}
                alt="Player QR code"
                className="w-36 h-36 rounded bg-white p-1 border border-gray-600"
              />
            )}
            <div className="space-y-2 min-w-0 flex-1">
              <p className="text-emerald-300 text-base">
                Signed in as <strong>{activeProfile.displayName}</strong>
              </p>
              {activeProfile.hasPin && (
                <p className="inline-flex items-center gap-1 text-xs text-slate-300">
                  <Shield size={12} />
                  PIN protected
                </p>
              )}
              <p className="text-gray-500 font-mono text-[11px] break-all">{activeProfile.qrPayload}</p>
              <button
                type="button"
                onClick={() => void copyQr()}
                className="inline-flex items-center gap-1 text-xs text-sky-300 hover:text-sky-200"
              >
                <Copy size={12} />
                Copy QR text
              </button>
            </div>
          </div>

          {Object.keys(activeProfile.personalBests || {}).length > 0 && (
            <div>
              <p className="text-gray-400 text-xs mb-1">Personal bests</p>
              <ul className="grid grid-cols-2 gap-1 text-gray-200">
                {Object.entries(activeProfile.personalBests).map(([game, score]) => (
                  <li key={game} className="bg-gray-900/60 rounded px-2 py-1 font-mono text-xs">
                    {game}: {score}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {activeProfile.tournamentHistory?.length > 0 && (
            <p className="text-xs text-gray-400">
              Competitions played: {activeProfile.tournamentHistory.length}
            </p>
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
        <div className="space-y-3">
          <div className="flex gap-2 text-xs">
            <button
              type="button"
              onClick={() => setMode('create')}
              className={`px-3 py-1 rounded ${mode === 'create' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300'}`}
            >
              New player
            </button>
            <button
              type="button"
              onClick={() => setMode('identify')}
              className={`px-3 py-1 rounded ${mode === 'identify' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300'}`}
            >
              Returning player
            </button>
          </div>

          {mode === 'create' ? (
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
                Optional PIN (4–8 digits)
                <input
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 8))}
                  inputMode="numeric"
                  type="password"
                  className="mt-1 w-full rounded bg-gray-900 border border-gray-600 px-2 py-1.5 text-white text-sm"
                />
              </label>
              <button
                type="button"
                onClick={() => void create()}
                className="sm:col-span-2 inline-flex items-center justify-center gap-2 px-3 py-2 rounded bg-blue-600 hover:bg-blue-500 text-white text-sm"
              >
                <UserPlus size={16} />
                Create profile &amp; sign in
              </button>
            </div>
          ) : (
            <div className="grid gap-3">
              <label className="text-xs text-gray-300">
                Player QR text
                <input
                  value={qrPayload}
                  onChange={(e) => setQrPayload(e.target.value)}
                  placeholder="kioskarcade:player:…"
                  className="mt-1 w-full rounded bg-gray-900 border border-gray-600 px-2 py-1.5 text-white text-sm font-mono"
                />
              </label>
              <label className="text-xs text-gray-300">
                PIN (if protected)
                <input
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 8))}
                  inputMode="numeric"
                  type="password"
                  className="mt-1 w-full rounded bg-gray-900 border border-gray-600 px-2 py-1.5 text-white text-sm"
                />
              </label>
              <button
                type="button"
                onClick={() => void identify()}
                className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded bg-slate-600 hover:bg-slate-500 text-white text-sm"
              >
                <QrCode size={16} />
                Sign in
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default PlayerProfile;
