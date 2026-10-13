import React from 'react';
import { useQuery } from 'react-query';
import { Award } from 'lucide-react';

const AchievementPanel: React.FC = () => {
  const { data: achievements = [] } = useQuery({
    queryKey: ['achievements'],
    queryFn: () => window.electronAPI.achievements.list()
  });

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
      <h3 className="text-white font-semibold flex items-center gap-2 mb-3">
        <Award size={18} className="text-amber-400" />
        Achievements
      </h3>
      <ul className="space-y-2 text-sm">
        {achievements.map((a: { id: string; name: string; description: string; gameId: string }) => (
          <li key={a.id} className="bg-gray-900/50 rounded px-3 py-2">
            <div className="text-white font-medium">{a.name}</div>
            <div className="text-gray-400 text-xs">
              {a.gameId} — {a.description}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default AchievementPanel;
