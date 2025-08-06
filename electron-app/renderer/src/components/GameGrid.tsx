import React, { useMemo } from 'react';
import { GameController, Download, Play, Settings } from 'lucide-react';

interface Game {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly category: string;
  readonly thumbnail: string;
  readonly isInstalled: boolean;
  readonly version?: string;
  readonly size?: number;
}

interface GameGridProps {
  readonly games: readonly Game[];
  readonly onGameLaunch: (gameId: string) => void;
}

const GameGrid: React.FC<GameGridProps> = ({ games, onGameLaunch }) => {
  const formatFileSize = useMemo(() => (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }, []);

  const getCategoryColor = useMemo(() => (category: string): string => {
    const colors: Record<string, string> = {
      'Puzzle': 'bg-blue-500',
      'Arcade': 'bg-green-500',
      'Sports': 'bg-orange-500',
      'Action': 'bg-red-500',
      'Strategy': 'bg-purple-500',
      'Racing': 'bg-yellow-500',
    };
    return colors[category] || 'bg-gray-500';
  }, []);

  if (games.length === 0) {
    return (
      <div className="text-center py-12">
        <GameController size={64} className="mx-auto mb-4 text-gray-400" />
        <h3 className="text-xl font-semibold mb-2">No Games Available</h3>
        <p className="text-gray-400 mb-4">
          No games are currently installed. Please check back later or contact an administrator.
        </p>
        <div className="text-sm text-gray-500">
          Press Ctrl+Alt+A to access admin panel
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {games.map((game) => (
        <div
          key={game.id}
          className="game-card bg-white bg-opacity-10 backdrop-blur-sm rounded-xl p-6 border border-white border-opacity-20 hover:bg-opacity-20 cursor-pointer"
          onClick={() => game.isInstalled && onGameLaunch(game.id)}
        >
          {/* Game Thumbnail */}
          <div className="relative mb-4">
            <div className="w-full h-32 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
              {game.thumbnail ? (
                <img
                  src={game.thumbnail}
                  alt={game.name}
                  className="w-full h-full object-cover rounded-lg"
                />
              ) : (
                <GameController size={48} className="text-white opacity-75" />
              )}
            </div>
            
            {/* Status Badge */}
            <div className="absolute top-2 right-2">
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                game.isInstalled 
                  ? 'bg-green-500 text-white' 
                  : 'bg-yellow-500 text-black'
              }`}>
                {game.isInstalled ? 'Ready' : 'Installing...'}
              </span>
            </div>
          </div>

          {/* Game Info */}
          <div className="space-y-2">
            <h3 className="text-lg font-semibold text-white truncate">
              {game.name}
            </h3>
            
            <p className="text-sm text-gray-300 line-clamp-2">
              {game.description}
            </p>

            <div className="flex items-center justify-between">
              <span className={`px-2 py-1 rounded text-xs font-medium ${getCategoryColor(game.category)}`}>
                {game.category}
              </span>
              
              {game.version && (
                <span className="text-xs text-gray-400">
                  v{game.version}
                </span>
              )}
            </div>

            {/* Game Size */}
            {game.size && (
              <div className="text-xs text-gray-400">
                Size: {formatFileSize(game.size)}
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex space-x-2 mt-4">
              {game.isInstalled ? (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onGameLaunch(game.id);
                  }}
                  className="flex-1 btn btn-primary flex items-center justify-center space-x-2"
                >
                  <Play size={16} />
                  <span>Play</span>
                </button>
              ) : (
                <button
                  className="flex-1 btn btn-secondary flex items-center justify-center space-x-2"
                  disabled
                >
                  <Download size={16} />
                  <span>Installing...</span>
                </button>
              )}
              
              <button
                onClick={(e) => e.stopPropagation()}
                className="btn btn-secondary p-2"
                title="Game Settings"
              >
                <Settings size={16} />
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default GameGrid; 