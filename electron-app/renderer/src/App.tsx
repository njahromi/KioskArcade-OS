import React, { useState, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import GameGrid from './components/GameGrid';
import SystemStatus from './components/SystemStatus';
import AdminAccess from './components/AdminAccess';

interface Game {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly category: string;
  readonly size: number;
  readonly version: string;
  readonly isInstalled: boolean;
  readonly isUpToDate: boolean;
}

interface SystemInfo {
  readonly arcadeId: string;
  readonly locationId: string;
  readonly locationName: string;
  readonly uptime: number;
  readonly gamesInstalled: number;
  readonly lastSync: string;
}

type ViewType = 'games' | 'system' | 'admin';

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<ViewType>('games');
  const [isLoading, setIsLoading] = useState(false);

  // Fetch games list
  const { data: games = [], isLoading: gamesLoading } = useQuery({
    queryKey: ['games'],
    queryFn: async () => {
      const games = await window.electronAPI.game.list();
      return games || [];
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Fetch system info
  const { data: systemInfo } = useQuery({
    queryKey: ['systemInfo'],
    queryFn: async () => {
      const token = await window.electronAPI.token.get();
      return {
        arcadeId: token?.arcadeId || 'Unknown',
        locationId: token?.locationId || 'Unknown',
        locationName: token?.locationName || 'Unknown Location',
        uptime: Date.now() - (token?.createdAt || Date.now()),
        gamesInstalled: games.length,
        lastSync: new Date().toISOString(),
      };
    },
    refetchInterval: 10000, // Refresh every 10 seconds
  });

  const handleGameLaunch = useCallback(async (gameId: string) => {
    setIsLoading(true);
    try {
      const success = await window.electronAPI.game.launch(gameId);
      if (success) {
        console.log(`Game ${gameId} launched successfully`);
      } else {
        console.error(`Failed to launch game ${gameId}`);
      }
    } catch (error) {
      console.error('Error launching game:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleAdminAccess = useCallback(async (password: string) => {
    try {
      const success = await window.electronAPI.admin.login(password);
      if (success) {
        setCurrentView('admin');
      } else {
        alert('Invalid admin password');
      }
    } catch (error) {
      console.error('Admin access error:', error);
      alert('Failed to access admin interface');
    }
  }, []);

  const handleSystemSync = useCallback(async () => {
    try {
      await window.electronAPI.admin.syncGames();
      alert('System sync completed');
    } catch (error) {
      console.error('Sync error:', error);
      alert('Failed to sync system');
    }
  }, []);

  const handleSystemRestart = useCallback(async () => {
    if (confirm('Are you sure you want to restart the system?')) {
      try {
        // This would typically call a system restart function
        console.log('System restart requested');
      } catch (error) {
        console.error('Restart error:', error);
      }
    }
  }, []);

  const handleBackToGames = useCallback(() => {
    setCurrentView('games');
  }, []);

  // Handle admin access shortcut (Ctrl+Alt+A)
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.altKey && event.key === 'A') {
        setCurrentView('admin');
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-white mx-auto mb-4"></div>
          <h2 className="text-2xl font-bold">Loading...</h2>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700 p-4">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold">KioskArcade OS</h1>
          <div className="flex space-x-4">
            <button
              onClick={() => setCurrentView('games')}
              className={`px-4 py-2 rounded ${currentView === 'games' ? 'bg-blue-600' : 'bg-gray-600 hover:bg-gray-500'}`}
            >
              Games
            </button>
            <button
              onClick={() => setCurrentView('system')}
              className={`px-4 py-2 rounded ${currentView === 'system' ? 'bg-blue-600' : 'bg-gray-600 hover:bg-gray-500'}`}
            >
              System
            </button>
            <button
              onClick={() => setCurrentView('admin')}
              className={`px-4 py-2 rounded ${currentView === 'admin' ? 'bg-blue-600' : 'bg-gray-600 hover:bg-gray-500'}`}
            >
              Admin
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="p-6">
        {currentView === 'games' && (
          <div>
            <h2 className="text-2xl font-bold mb-6">Available Games</h2>
            {gamesLoading ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-white mx-auto mb-4"></div>
                <p>Loading games...</p>
              </div>
            ) : (
              <GameGrid games={games} onGameLaunch={handleGameLaunch} />
            )}
          </div>
        )}

        {currentView === 'system' && systemInfo && (
          <div>
            <h2 className="text-2xl font-bold mb-6">System Status</h2>
            <SystemStatus systemInfo={systemInfo} />
            <div className="mt-6 flex space-x-4">
              <button
                onClick={handleSystemSync}
                className="px-6 py-3 bg-green-600 hover:bg-green-500 rounded-lg font-semibold"
              >
                Sync System
              </button>
              <button
                onClick={handleSystemRestart}
                className="px-6 py-3 bg-red-600 hover:bg-red-500 rounded-lg font-semibold"
              >
                Restart System
              </button>
            </div>
          </div>
        )}

        {currentView === 'admin' && (
          <div>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold">Admin Access</h2>
              <button
                onClick={handleBackToGames}
                className="px-4 py-2 bg-gray-600 hover:bg-gray-500 rounded"
              >
                Back to Games
              </button>
            </div>
            <AdminAccess onAccess={handleAdminAccess} />
          </div>
        )}
      </main>
    </div>
  );
};

export default App; 