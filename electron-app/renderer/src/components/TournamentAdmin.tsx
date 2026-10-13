import React, { useState } from 'react';
import { useQuery, useQueryClient } from 'react-query';
import toast from 'react-hot-toast';
import { Flag, Plus, Square, RefreshCw, Gift } from 'lucide-react';

interface TournamentAdminProps {
  readonly sessionPassword: string;
}

const TournamentAdmin: React.FC<TournamentAdminProps> = ({ sessionPassword }) => {
  const queryClient = useQueryClient();
  const [name, setName] = useState('Daily High Score');
  const [gameId, setGameId] = useState('tetris');
  const [busy, setBusy] = useState(false);
  const [rewardName, setRewardName] = useState('Free Play Credit');
  const [scheduleName, setScheduleName] = useState('Evening Challenge');

  const { data: supportedGames = [] } = useQuery({
    queryKey: ['competitionSupportedGames'],
    queryFn: () => window.electronAPI.competition.supportedGames()
  });

  const { data: competitions = [] } = useQuery({
    queryKey: ['competitions'],
    queryFn: () => window.electronAPI.competition.list(),
    refetchInterval: 10_000
  });

  const { data: flagged = [] } = useQuery({
    queryKey: ['flaggedScores'],
    queryFn: () => window.electronAPI.competition.getFlagged(),
    refetchInterval: 10_000
  });

  const { data: redemptions = [] } = useQuery({
    queryKey: ['rewardRedemptions'],
    queryFn: () => window.electronAPI.rewards.redemptions('pending'),
    refetchInterval: 15_000
  });

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ['competitions'] });
    void queryClient.invalidateQueries({ queryKey: ['competitionActive'] });
    void queryClient.invalidateQueries({ queryKey: ['leaderboard'] });
    void queryClient.invalidateQueries({ queryKey: ['flaggedScores'] });
    void queryClient.invalidateQueries({ queryKey: ['rewardRedemptions'] });
  };

  const createCompetition = async () => {
    setBusy(true);
    try {
      const created = await window.electronAPI.competition.create(sessionPassword, {
        name,
        gameId,
        metric: 'high_score'
      });
      if (created) {
        toast.success(`Competition “${created.name}” is live`);
        refresh();
      } else {
        toast.error('Could not create competition');
      }
    } finally {
      setBusy(false);
    }
  };

  const endCompetition = async (competitionId: string) => {
    setBusy(true);
    try {
      const ok = await window.electronAPI.competition.end(sessionPassword, competitionId);
      if (ok) {
        toast.success('Competition ended');
        refresh();
      } else {
        toast.error('Could not end competition');
      }
    } finally {
      setBusy(false);
    }
  };

  const review = async (submissionId: string, decision: 'accepted' | 'rejected') => {
    const result = await window.electronAPI.competition.reviewSubmission(
      sessionPassword,
      submissionId,
      decision
    );
    if (result) {
      toast.success(`Submission ${decision}`);
      refresh();
    } else {
      toast.error('Review failed');
    }
  };

  const syncNow = async () => {
    const result = await window.electronAPI.competition.syncNow(sessionPassword);
    if (result) {
      toast.success(`Synced (pushed ${result.pushed}, pulled ${result.pulled})`);
    } else {
      toast.error('Sync failed or disabled');
    }
  };

  const createReward = async () => {
    const reward = await window.electronAPI.rewards.create(sessionPassword, {
      name: rewardName,
      type: 'free_play',
      description: 'One free play credit for top finishers',
      requiresStaffApproval: true
    });
    if (reward) {
      toast.success('Reward created');
    } else {
      toast.error('Could not create reward');
    }
  };

  const addDailySchedule = async () => {
    const schedule = await window.electronAPI.competition.upsertSchedule(sessionPassword, {
      name: scheduleName,
      gameId,
      cadence: 'daily',
      startTime: '18:00',
      durationMinutes: 120,
      enabled: true,
      seasonId: null,
      bracketEnabled: false
    });
    if (schedule) {
      toast.success('Daily schedule saved (spawns at 18:00 local)');
    } else {
      toast.error('Could not save schedule');
    }
  };

  const approveRedemption = async (redemptionId: string) => {
    const result = await window.electronAPI.rewards.review(
      sessionPassword,
      redemptionId,
      'approved'
    );
    if (result) {
      toast.success('Redemption approved');
      refresh();
    }
  };

  const games = supportedGames.length > 0 ? supportedGames : ['tetris', 'snake', 'pong'];

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
        <h3 className="text-lg font-semibold text-white mb-2">Competition Hub</h3>
        <p className="text-gray-400 text-sm mb-4">
          Create local high-score events. Scores are validated from the game session, not the kiosk UI.
        </p>
        <div className="grid gap-3 sm:grid-cols-2 mb-4">
          <label className="text-sm text-gray-300">
            Name
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded bg-gray-900 border border-gray-600 px-3 py-2 text-white"
            />
          </label>
          <label className="text-sm text-gray-300">
            Game
            <select
              value={gameId}
              onChange={(e) => setGameId(e.target.value)}
              className="mt-1 w-full rounded bg-gray-900 border border-gray-600 px-3 py-2 text-white"
            >
              {games.map((id) => (
                <option key={id} value={id}>
                  {id}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            disabled={busy}
            onClick={() => void createCompetition()}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white font-medium"
          >
            <Plus size={18} />
            Start competition
          </button>
          <button
            type="button"
            onClick={() => void syncNow()}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-600 hover:bg-slate-500 text-white font-medium"
          >
            <RefreshCw size={18} />
            Sync now
          </button>
        </div>
      </div>

      <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
        <h3 className="text-lg font-semibold text-white mb-3">Competitions</h3>
        {competitions.length === 0 ? (
          <p className="text-sm text-gray-400">No competitions yet.</p>
        ) : (
          <ul className="space-y-2">
            {competitions.map((c: { id: string; name: string; gameId: string; status: string }) => (
              <li
                key={c.id}
                className="flex items-center justify-between gap-3 bg-gray-900/50 rounded px-3 py-2 text-sm"
              >
                <div>
                  <div className="text-white font-medium">{c.name}</div>
                  <div className="text-gray-400 font-mono text-xs">
                    {c.gameId} · {c.status}
                  </div>
                </div>
                {c.status === 'active' && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void endCompetition(c.id)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded bg-red-700 hover:bg-red-600 text-white text-xs"
                  >
                    <Square size={14} />
                    End
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
        <h3 className="text-lg font-semibold text-white mb-2 flex items-center gap-2">
          <Flag size={18} className="text-amber-400" />
          Flagged scores
        </h3>
        {flagged.length === 0 ? (
          <p className="text-sm text-gray-400">No flagged submissions.</p>
        ) : (
          <ul className="space-y-2">
            {flagged.map((s: {
              id: string;
              displayName: string;
              score: number;
              validationReason?: string;
            }) => (
              <li
                key={s.id}
                className="flex flex-wrap items-center justify-between gap-2 bg-gray-900/50 rounded px-3 py-2 text-sm"
              >
                <span className="text-gray-200">
                  {s.displayName}: <span className="font-mono">{s.score}</span>
                  {s.validationReason && (
                    <span className="text-amber-500 ml-2 text-xs">{s.validationReason}</span>
                  )}
                </span>
                <span className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => void review(s.id, 'accepted')}
                    className="px-2 py-1 rounded bg-emerald-700 text-xs text-white"
                  >
                    Accept
                  </button>
                  <button
                    type="button"
                    onClick={() => void review(s.id, 'rejected')}
                    className="px-2 py-1 rounded bg-red-800 text-xs text-white"
                  >
                    Reject
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
        <h3 className="text-lg font-semibold text-white mb-2">Scheduled tournaments</h3>
        <div className="flex flex-wrap gap-3 items-end">
          <label className="text-sm text-gray-300 flex-1 min-w-[160px]">
            Schedule name
            <input
              value={scheduleName}
              onChange={(e) => setScheduleName(e.target.value)}
              className="mt-1 w-full rounded bg-gray-900 border border-gray-600 px-3 py-2 text-white"
            />
          </label>
          <button
            type="button"
            onClick={() => void addDailySchedule()}
            className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm"
          >
            Add daily 18:00
          </button>
        </div>
      </div>

      <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
        <h3 className="text-lg font-semibold text-white mb-2 flex items-center gap-2">
          <Gift size={18} />
          Rewards
        </h3>
        <div className="flex flex-wrap gap-3 items-end mb-4">
          <label className="text-sm text-gray-300 flex-1 min-w-[160px]">
            Reward name
            <input
              value={rewardName}
              onChange={(e) => setRewardName(e.target.value)}
              className="mt-1 w-full rounded bg-gray-900 border border-gray-600 px-3 py-2 text-white"
            />
          </label>
          <button
            type="button"
            onClick={() => void createReward()}
            className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-sm"
          >
            Create free-play reward
          </button>
        </div>
        {redemptions.length > 0 && (
          <ul className="space-y-2">
            {redemptions.map((r: { id: string; displayName: string; rewardId: string }) => (
              <li
                key={r.id}
                className="flex justify-between items-center bg-gray-900/50 rounded px-3 py-2 text-sm"
              >
                <span className="text-gray-200">
                  {r.displayName} · {r.rewardId.slice(0, 8)}
                </span>
                <button
                  type="button"
                  onClick={() => void approveRedemption(r.id)}
                  className="px-2 py-1 rounded bg-emerald-700 text-xs text-white"
                >
                  Approve
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default TournamentAdmin;
