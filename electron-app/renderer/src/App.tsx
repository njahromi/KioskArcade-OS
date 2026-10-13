import React, { useState, useEffect, useCallback } from 'react';
import { useQuery, useQueryClient } from 'react-query';
import toast from 'react-hot-toast';
import GameGrid from './components/GameGrid';
import SystemStatus from './components/SystemStatus';
import AdminAccess from './components/AdminAccess';
import BootHealthGate from './components/BootHealthGate';
import ClosedVenueScreen from './components/ClosedVenueScreen';
import VenueOverrideControls from './components/VenueOverrideControls';
import TournamentBrowser from './components/TournamentBrowser';
import TournamentAdmin from './components/TournamentAdmin';

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
  const queryClient = useQueryClient();
  const [currentView, setCurrentView] = useState<ViewType>('games');
  const [isLoading, setIsLoading] = useState(false);
  const [adminSessionPassword, setAdminSessionPassword] = useState<string | null>(null);
  const [healthGateDone, setHealthGateDone] = useState(false);

  const { data: appConfig, isLoading: configLoading } = useQuery({
    queryKey: ['appConfig'],
    queryFn: async () => window.electronAPI.config.get(),
    staleTime: 60_000
  });

  const { data: venueStatus } = useQuery({
    queryKey: ['venueStatus'],
    queryFn: async () => window.electronAPI.venue.getStatus(),
    refetchInterval: 30_000
  });

  const { data: games = [], isLoading: gamesLoading } = useQuery({
    queryKey: ['games'],
    queryFn: async () => {
      const list = await window.electronAPI.game.list();
      return list || [];
    },
    refetchInterval: 30_000
  });

  const { data: systemInfo } = useQuery({
    queryKey: ['systemInfo', games.length],
    queryFn: async () => {
      const token = await window.electronAPI.token.get();
      return {
        arcadeId: token?.arcadeId || 'Unknown',
        locationId: token?.locationId || 'Unknown',
        locationName: token?.locationName || 'Unknown Location',
        uptime: Date.now() - (token?.createdAt || Date.now()),
        gamesInstalled: games.length,
        lastSync: new Date().toISOString()
      } as SystemInfo;
    },
    refetchInterval: 10_000
  });

  useEffect(() => {
    if (!appConfig) return;
    const need =
      appConfig.healthCheck?.enabled === true && appConfig.healthCheck?.blockPublicUntilPass === true;
    if (!need) {
      setHealthGateDone(true);
    }
  }, [appConfig]);

  useEffect(() => {
    const a = appConfig?.accessibility;
    if (!a) return;
    const root = document.documentElement;
    root.dataset.highContrast = String(!!a.highContrast);
    root.dataset.largeTouchTargets = String(!!a.largeTouchTargets);
    root.dataset.reduceMotion = String(!!a.reduceMotion);
    return () => {
      delete root.dataset.highContrast;
      delete root.dataset.largeTouchTargets;
      delete root.dataset.reduceMotion;
    };
  }, [appConfig?.accessibility]);

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
    const success = await window.electronAPI.admin.login(password);
    if (success) {
      setAdminSessionPassword(password);
      setCurrentView('admin');
    } else {
      alert('Invalid admin password');
    }
  }, []);

  const handleAdminLogout = useCallback(() => {
    setAdminSessionPassword(null);
  }, []);

  const handleVenueChanged = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ['venueStatus'] });
  }, [queryClient]);

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
        console.log('System restart requested');
      } catch (error) {
        console.error('Restart error:', error);
      }
    }
  }, []);

  const handleBackToGames = useCallback(() => {
    setCurrentView('games');
    setAdminSessionPassword(null);
  }, []);

  const onHealthPassed = useCallback(() => {
    setHealthGateDone(true);
  }, []);

  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.altKey && event.key === 'A') {
        setCurrentView('admin');
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, []);

  useEffect(() => {
    if (!window.electronAPI?.competition?.onScoreSubmitted) return;
    const offScore = window.electronAPI.competition.onScoreSubmitted(() => {
      void queryClient.invalidateQueries({ queryKey: ['leaderboard'] });
      void queryClient.invalidateQueries({ queryKey: ['competitions'] });
      void queryClient.invalidateQueries({ queryKey: ['flaggedScores'] });
      void queryClient.invalidateQueries({ queryKey: ['playerSession'] });
      void queryClient.invalidateQueries({ queryKey: ['achievementProgress'] });
    });
    const offExit = window.electronAPI.competition.onGameExited?.(() => {
      setIsLoading(false);
      void queryClient.invalidateQueries({ queryKey: ['leaderboard'] });
      void queryClient.invalidateQueries({ queryKey: ['playerSession'] });
    });
    const offUnlock = window.electronAPI.achievements?.onUnlocked?.((unlocks) => {
      for (const u of unlocks as Array<{ name?: string; achievementId: string }>) {
        toast.success(`Achievement unlocked: ${u.name ?? u.achievementId}`, {
          duration: 4000,
          icon: '🏆'
        });
      }
      void queryClient.invalidateQueries({ queryKey: ['achievementProgress'] });
      void queryClient.invalidateQueries({ queryKey: ['playerSession'] });
    });
    return () => {
      offScore?.();
      offExit?.();
      offUnlock?.();
    };
  }, [queryClient]);

  const needsHealthGate =
    appConfig?.healthCheck?.enabled === true && appConfig?.healthCheck?.blockPublicUntilPass === true;

  const venueClosed =
    venueStatus?.venueEnabled === true && venueStatus?.isOpen === false;

  if (configLoading || !appConfig) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-white mx-auto mb-4" />
          <p className="text-slate-400">Loading configuration…</p>
        </div>
      </div>
    );
  }

  if (needsHealthGate && !healthGateDone) {
    return <BootHealthGate onPassed={onHealthPassed} />;
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-white mx-auto mb-4" />
          <h2 className="text-2xl font-bold">Loading...</h2>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <header className="bg-gray-800 border-b border-gray-700 p-4">
        <div className="flex justify-between items-center flex-wrap gap-4">
          <h1 className="text-3xl font-bold">KioskArcade OS</h1>
          <div className="flex space-x-4">
            <button
              type="button"
              onClick={() => setCurrentView('games')}
              className={`px-4 py-2 rounded ${currentView === 'games' ? 'bg-blue-600' : 'bg-gray-600 hover:bg-gray-500'}`}
            >
              Games
            </button>
            <button
              type="button"
              onClick={() => setCurrentView('system')}
              className={`px-4 py-2 rounded ${currentView === 'system' ? 'bg-blue-600' : 'bg-gray-600 hover:bg-gray-500'}`}
            >
              System
            </button>
            <button
              type="button"
              onClick={() => setCurrentView('admin')}
              className={`px-4 py-2 rounded ${currentView === 'admin' ? 'bg-blue-600' : 'bg-gray-600 hover:bg-gray-500'}`}
            >
              Admin
            </button>
          </div>
        </div>
      </header>

      <main className="p-6">
        {currentView === 'games' && venueClosed && venueStatus && (
          <ClosedVenueScreen
            title={venueStatus.closedTitle}
            subtitle={venueStatus.closedSubtitle}
            locationName={appConfig.arcade.locationName}
            onStaffLogin={() => setCurrentView('admin')}
          />
        )}

        {currentView === 'games' && !venueClosed && (
          <div>
            <h2 className="text-2xl font-bold mb-6">Available Games</h2>
            {appConfig.competitions?.enabled !== false && (
              <TournamentBrowser onLaunchGame={(id) => void handleGameLaunch(id)} />
            )}
            {gamesLoading ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-white mx-auto mb-4" />
                <p>Loading games...</p>
              </div>
            ) : (
              <GameGrid games={games} onGameLaunch={handleGameLaunch} launchDisabled={false} />
            )}
          </div>
        )}

        {currentView === 'system' && systemInfo && (
          <div>
            <h2 className="text-2xl font-bold mb-6">System Status</h2>
            <SystemStatus systemInfo={systemInfo} />
            <div className="mt-6 flex space-x-4">
              <button
                type="button"
                onClick={handleSystemSync}
                className="px-6 py-3 bg-green-600 hover:bg-green-500 rounded-lg font-semibold"
              >
                Sync System
              </button>
              <button
                type="button"
                onClick={handleSystemRestart}
                className="px-6 py-3 bg-red-600 hover:bg-red-500 rounded-lg font-semibold"
              >
                Restart System
              </button>
            </div>
          </div>
        )}

        {currentView === 'admin' && !adminSessionPassword && (
          <div>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold">Admin Access</h2>
              <button
                type="button"
                onClick={handleBackToGames}
                className="px-4 py-2 bg-gray-600 hover:bg-gray-500 rounded"
              >
                Back to Games
              </button>
            </div>
            <AdminAccess onAccess={handleAdminAccess} />
          </div>
        )}

        {currentView === 'admin' && adminSessionPassword && venueStatus && (
          <div>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold">Admin</h2>
              <button
                type="button"
                onClick={handleBackToGames}
                className="px-4 py-2 bg-gray-600 hover:bg-gray-500 rounded"
              >
                Back to Games
              </button>
            </div>
            <div className="space-y-8">
              <VenueOverrideControls
                sessionPassword={adminSessionPassword}
                venueEnabled={appConfig.venue.enabled}
                venueOverride={venueStatus.override}
                onLogout={handleAdminLogout}
                onVenueChanged={handleVenueChanged}
              />
              {appConfig.competitions?.enabled !== false && (
                <TournamentAdmin sessionPassword={adminSessionPassword} />
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
