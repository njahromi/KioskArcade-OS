import React from 'react';
import { useQuery, useQueryClient } from 'react-query';
import toast from 'react-hot-toast';
import { Gift, Ticket } from 'lucide-react';

const RewardsPanel: React.FC = () => {
  const queryClient = useQueryClient();

  const { data: rewards = [] } = useQuery({
    queryKey: ['activeRewards'],
    queryFn: () => window.electronAPI.rewards.list(true),
    refetchInterval: 20_000
  });

  const { data: mine = [] } = useQuery({
    queryKey: ['myRedemptions'],
    queryFn: () => window.electronAPI.rewards.mine(),
    refetchInterval: 10_000
  });

  const claim = async (rewardId: string, name: string) => {
    const result = await window.electronAPI.rewards.request(rewardId);
    if (!result) {
      toast.error('Could not claim (already claimed or unavailable)');
      return;
    }
    toast.success(
      result.status === 'pending'
        ? `${name} submitted for staff approval`
        : `${name} approved — show staff to redeem`
    );
    void queryClient.invalidateQueries({ queryKey: ['myRedemptions'] });
  };

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 space-y-4">
      <h3 className="text-white font-semibold flex items-center gap-2">
        <Gift size={18} className="text-pink-400" />
        Rewards
      </h3>
      <ul className="space-y-2 text-sm">
        {rewards.map(
          (r: {
            id: string;
            name: string;
            type: string;
            description: string;
            requiresStaffApproval: boolean;
            autoGrantTopN: number | null;
          }) => (
            <li
              key={r.id}
              className="flex flex-wrap items-center justify-between gap-2 bg-gray-900/50 rounded px-3 py-2"
            >
              <div>
                <div className="text-white font-medium">{r.name}</div>
                <div className="text-xs text-gray-400">
                  {r.type}
                  {r.requiresStaffApproval ? ' · staff approval' : ' · instant'}
                  {r.autoGrantTopN ? ` · auto top ${r.autoGrantTopN}` : ''}
                </div>
                <div className="text-xs text-gray-500 mt-0.5">{r.description}</div>
              </div>
              <button
                type="button"
                onClick={() => void claim(r.id, r.name)}
                className="px-3 py-1.5 rounded bg-pink-700 hover:bg-pink-600 text-white text-xs"
              >
                Claim
              </button>
            </li>
          )
        )}
        {rewards.length === 0 && (
          <li className="text-gray-400 text-sm">No active rewards right now.</li>
        )}
      </ul>

      <div>
        <h4 className="text-sm text-gray-300 flex items-center gap-1 mb-2">
          <Ticket size={14} />
          Your claims
        </h4>
        {mine.length === 0 ? (
          <p className="text-xs text-gray-500">No redemptions yet.</p>
        ) : (
          <ul className="space-y-1 text-xs">
            {mine.map((r: { id: string; rewardId: string; status: string; requestedAt: string }) => (
              <li key={r.id} className="bg-gray-900/40 rounded px-2 py-1.5 text-gray-300">
                <span className="font-mono text-amber-300">{r.status}</span>
                <span className="ml-2 text-gray-500">
                  {new Date(r.requestedAt).toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default RewardsPanel;
