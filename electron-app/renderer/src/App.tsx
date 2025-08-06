import React, { useState, useEffect, useCallback } from 'react';
import { useQuery } from 'react-query';
import toast from 'react-hot-toast';
import { Activity, Settings } from 'lucide-react';
import GameGrid from './components/GameGrid';
import SystemStatus from './components/SystemStatus';
import AdminAccess from './components/AdminAccess';

interface Game {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly category: string;
  readonly thumbnail: string;
  readonly isInstalled: boolean;
}

interface SystemInfo {
  readonly arcadeId: string;
  readonly locationId: string;
  readonly locationName: string;
  readonly uptime: number;
  readonly gamesInstalled: number;
  readonly lastSync: string;
}

type ViewType = 'games' | 'admin' | 'status';

const App: React.FC = () => {
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [currentView, setCurrentView] = useState<ViewType>('games');

  // Fetch games list
  const { data: games, isLoading: gamesLoading, refetch: refetchGames } = useQuery<Game[]>(
    'games',
    async () => {
      if (window.electronAPI) {
        return await window.electronAPI.game.list();
      }
      return [];
    },
    {
      refetchInterval: 30000, // Refetch every 30 seconds
    }
  );

  // Fetch system info
  const { data: systemInfo, isLoading: systemLoading } = useQuery<SystemInfo>(
    'systemInfo',
    async () => {
      if (window.electronAPI) {
        const config = await window.electronAPI.admin.getConfig();
        return {
          arcadeId: config?.arcadeId || 'Unknown',
          locationId: config?.locationId || 'Unknown',
          locationName: config?.locationName || 'Unknown Location',
          uptime: 0, // Would be calculated from system start time
          gamesInstalled: games?.length || 0,
          lastSync: new Date().toISOString(),
        };
      }
      return {
        arcadeId: 'Unknown',
        locationId: 'Unknown',
        locationName: 'Unknown Location',
        uptime: 0,
        gamesInstalled: 0,
        lastSync: new Date().toISOString(),
      };
    }
  );

  // Handle game launch
  const handleGameLaunch = useCallback(async (gameId: string) => {
    try {
      if (window.electronAPI) {
        const success = await window.electronAPI.game.launch(gameId);
        if (success) {
          toast.success(`Launching ${gameId}...`);
        } else {
          toast.error(`Failed to launch ${gameId}`);
        }
      }
    } catch (error) {
      toast.error(`Error launching game: ${error}`);
    }
  }, []);

  // Handle admin access
  const handleAdminAccess = useCallback((password: string) => {
    // In a real implementation, this would validate the password
    if (password === 'admin123') {
      setIsAdminMode(true);
      setCurrentView('admin');
      toast.success('Admin access granted');
    } else {
      toast.error('Invalid admin password');
    }
  }, []);

  // Handle system sync
  const handleSystemSync = useCallback(async () => {
    try {
      if (window.electronAPI) {
        const success = await window.electronAPI.admin.syncGames();
        if (success) {
          toast.success('System synchronized successfully');
          refetchGames();
        } else {
          toast.error('System synchronization failed');
        }
      }
    } catch (error) {
      toast.error(`Sync error: ${error}`);
    }
  }, [refetchGames]);

  // Handle system restart
  const handleSystemRestart = useCallback(() => {
    if (confirm('Are you sure you want to restart the system?')) {
      // In a real implementation, this would trigger a system restart
      toast.success('System restart initiated');
    }
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      // Ctrl+Alt+A for admin access
      if (event.ctrlKey && event.altKey && event.key === 'a') {
        event.preventDefault();
        setCurrentView('admin');
      }
      
      // Ctrl+Alt+S for system status
      if (event.ctrlKey && event.altKey && event.key === 's') {
        event.preventDefault();
        setCurrentView('status');
      }
      
      // Escape to return to games
      if (event.key === 'Escape') {
        setCurrentView('games');
        setIsAdminMode(false);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, []);

  const handleBackToGames = useCallback(() => {
    setCurrentView('games');
    setIsAdminMode(false);
  }, []);

  if (currentView === 'admin') {
    return (
      <AdminAccess
        onLogin={handleAdminAccess}
        onBack={handleBackToGames}
      />
    );
  }

  if (currentView === 'status') {
    return (
      <SystemStatus
        systemInfo={systemInfo}
        isLoading={systemLoading}
        onBack={handleBackToGames}
        onSync={handleSystemSync}
        onRestart={handleSystemRestart}
      />
    );
  }

  return (
    <div className="min-h-screen arcade-bg text-white">
      {/* Header */}
      <header className="bg-black bg-opacity-50 p-4">
        <div className="flex justify-between items-center">
          <div className="flex items-center space-x-4">
            <h1 className="text-3xl font-bold arcade-text">🎮 KioskArcade OS</h1>
            {systemInfo && (
              <div className="text-sm opacity-75">
                {systemInfo.locationName} • {systemInfo.arcadeId}
              </div>
            )}
          </div>
          
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setCurrentView('status')}
              className="p-2 rounded-lg bg-blue-600 hover:bg-blue-700 transition-colors"
              title="System Status (Ctrl+Alt+S)"
            >
              <Activity size={20} />
            </button>
            
            <button
              onClick={() => setCurrentView('admin')}
              className="p-2 rounded-lg bg-gray-600 hover:bg-gray-700 transition-colors"
              title="Admin Access (Ctrl+Alt+A)"
            >
              <Settings size={20} />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-8">
        {gamesLoading ? (
          <div className="flex justify-center items-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
              <p className="text-lg">Loading games...</p>
            </div>
          </div>
        ) : (
          <GameGrid
            games={games || []}
            onGameLaunch={handleGameLaunch}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="bg-black bg-opacity-50 p-4">
        <div className="flex justify-between items-center text-sm opacity-75">
          <div>
            {systemInfo && (
              <span>Uptime: {Math.floor(systemInfo.uptime / 3600)}h {Math.floor((systemInfo.uptime % 3600) / 60)}m</span>
            )}
          </div>
          
          <div className="flex items-center space-x-4">
            <span>Games: {games?.length || 0}</span>
            <span>Press ESC to return to games</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default App; 