import { contextBridge, ipcRenderer } from 'electron';

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Admin interface methods
  admin: {
    login: (password: string) => ipcRenderer.invoke('admin:login', password),
    getConfig: () => ipcRenderer.invoke('admin:get-config'),
    updateConfig: (config: any) => ipcRenderer.invoke('admin:update-config', config),
    testNetwork: () => ipcRenderer.invoke('admin:test-network'),
    syncGames: () => ipcRenderer.invoke('admin:sync-games'),
    getLogs: () => ipcRenderer.invoke('admin:get-logs')
  },

  // Game management methods
  game: {
    launch: (gameId: string) => ipcRenderer.invoke('game:launch', gameId),
    list: () => ipcRenderer.invoke('game:list'),
    update: (gameId: string) => ipcRenderer.invoke('game:update', gameId)
  },

  // Token management methods
  token: {
    get: () => ipcRenderer.invoke('token:get'),
    rotate: () => ipcRenderer.invoke('token:rotate')
  },

  // Security methods
  security: {
    lockdown: () => ipcRenderer.invoke('security:lockdown'),
    status: () => ipcRenderer.invoke('security:status')
  },

  // Analytics methods
  analytics: {
    getSummary: () => ipcRenderer.invoke('analytics:get-summary'),
    exportData: () => ipcRenderer.invoke('analytics:export-data'),
    clearData: () => ipcRenderer.invoke('analytics:clear-data')
  },

  // Multi-arcade management methods
  multiArcade: {
    getStatus: () => ipcRenderer.invoke('multiarcade:get-status'),
    getUnits: () => ipcRenderer.invoke('multiarcade:get-units'),
    addUnit: (unit: any) => ipcRenderer.invoke('multiarcade:add-unit', unit),
    removeUnit: (unitId: string) => ipcRenderer.invoke('multiarcade:remove-unit', unitId),
    distributeGame: (gameId: string, units: string[]) => ipcRenderer.invoke('multiarcade:distribute-game', gameId, units)
  },

  // Configuration methods
  config: {
    get: () => ipcRenderer.invoke('config:get'),
    update: (updates: any) => ipcRenderer.invoke('config:update', updates),
    isFeatureEnabled: (feature: string) => ipcRenderer.invoke('config:is-feature-enabled', feature)
  },

  venue: {
    getStatus: () => ipcRenderer.invoke('venue:get-status'),
    setOverride: (password: string, mode: 'none' | 'force_open') =>
      ipcRenderer.invoke('venue:set-override', { password, mode })
  },

  health: {
    runChecks: () => ipcRenderer.invoke('health:run-checks')
  },

  competition: {
    list: () => ipcRenderer.invoke('competition:list'),
    getActive: (gameId?: string) => ipcRenderer.invoke('competition:get-active', gameId),
    getLeaderboard: (competitionId: string, limit?: number) =>
      ipcRenderer.invoke('competition:get-leaderboard', { competitionId, limit }),
    create: (password: string, input: {
      name: string;
      gameId: string;
      metric?: 'high_score' | 'fastest_time';
      startsAt?: string;
      endsAt?: string | null;
      seasonId?: string | null;
      bracketEnabled?: boolean;
    }) => ipcRenderer.invoke('competition:create', { password, ...input }),
    end: (password: string, competitionId: string) =>
      ipcRenderer.invoke('competition:end', { password, competitionId }),
    setDisplayName: (displayName: string) =>
      ipcRenderer.invoke('competition:set-display-name', displayName),
    getDisplayName: () => ipcRenderer.invoke('competition:get-display-name'),
    getFlagged: (competitionId?: string) =>
      ipcRenderer.invoke('competition:get-flagged', competitionId),
    reviewSubmission: (password: string, submissionId: string, decision: 'accepted' | 'rejected') =>
      ipcRenderer.invoke('competition:review-submission', { password, submissionId, decision }),
    supportedGames: () => ipcRenderer.invoke('competition:supported-games'),
    venueLeaderboard: (limit?: number) =>
      ipcRenderer.invoke('competition:venue-leaderboard', limit),
    exitGame: () => ipcRenderer.invoke('competition:exit-game'),
    listSchedules: () => ipcRenderer.invoke('competition:list-schedules'),
    upsertSchedule: (password: string, schedule: {
      id?: string;
      name: string;
      gameId: string;
      cadence: 'daily' | 'weekly' | 'once';
      startTime: string;
      durationMinutes: number;
      enabled: boolean;
      seasonId?: string | null;
      bracketEnabled?: boolean;
    }) => ipcRenderer.invoke('competition:upsert-schedule', { password, schedule }),
    syncNow: (password: string) => ipcRenderer.invoke('competition:sync-now', password),
    syncQueue: () => ipcRenderer.invoke('competition:sync-queue'),
    onScoreSubmitted: (callback: (submission: unknown) => void) => {
      const listener = (_event: unknown, submission: unknown) => callback(submission);
      ipcRenderer.on('competition:score-submitted', listener);
      return () => ipcRenderer.removeListener('competition:score-submitted', listener);
    },
    onGameExited: (callback: () => void) => {
      const listener = () => callback();
      ipcRenderer.on('competition:game-exited', listener);
      return () => ipcRenderer.removeListener('competition:game-exited', listener);
    }
  },

  player: {
    create: (displayName: string, pin?: string) =>
      ipcRenderer.invoke('player:create', { displayName, pin }),
    list: () => ipcRenderer.invoke('player:list'),
    get: (playerId: string) => ipcRenderer.invoke('player:get', playerId),
    identify: (payload: { qrPayload?: string; playerId?: string; pin?: string }) =>
      ipcRenderer.invoke('player:identify', payload),
    clear: () => ipcRenderer.invoke('player:clear')
  },

  achievements: {
    list: () => ipcRenderer.invoke('achievements:list'),
    unlocks: (playerId?: string) => ipcRenderer.invoke('achievements:unlocks', playerId)
  },

  rewards: {
    list: (activeOnly?: boolean) => ipcRenderer.invoke('rewards:list', activeOnly),
    create: (password: string, input: {
      name: string;
      type: 'badge' | 'free_play' | 'coupon' | 'prize';
      description: string;
      requiresStaffApproval: boolean;
      competitionId?: string | null;
    }) => ipcRenderer.invoke('rewards:create', { password, ...input }),
    request: (rewardId: string, displayName?: string, competitionId?: string | null) =>
      ipcRenderer.invoke('rewards:request', { rewardId, displayName, competitionId }),
    redemptions: (status?: 'pending' | 'approved' | 'rejected' | 'fulfilled') =>
      ipcRenderer.invoke('rewards:redemptions', status),
    review: (
      password: string,
      redemptionId: string,
      decision: 'approved' | 'rejected' | 'fulfilled',
      notes?: string
    ) => ipcRenderer.invoke('rewards:review', { password, redemptionId, decision, notes })
  },

  // System information
  system: {
    getVersion: () => process.versions.electron,
    getPlatform: () => process.platform,
    getArch: () => process.arch
  }
});

// Type definitions for TypeScript support
declare global {
  interface Window {
    electronAPI: {
      admin: {
        login: (password: string) => Promise<boolean>;
        getConfig: () => Promise<any>;
        updateConfig: (config: any) => Promise<boolean>;
        testNetwork: () => Promise<any>;
        syncGames: () => Promise<boolean>;
        getLogs: () => Promise<string[]>;
      };
      game: {
        launch: (gameId: string) => Promise<boolean>;
        list: () => Promise<any[]>;
        update: (gameId: string) => Promise<boolean>;
      };
      token: {
        get: () => Promise<string>;
        rotate: () => Promise<boolean>;
      };
      security: {
        lockdown: () => Promise<boolean>;
        status: () => Promise<any>;
      };
      analytics: {
        getSummary: () => Promise<any>;
        exportData: () => Promise<any>;
        clearData: () => Promise<boolean>;
      };
      multiArcade: {
        getStatus: () => Promise<any>;
        getUnits: () => Promise<any[]>;
        addUnit: (unit: any) => Promise<boolean>;
        removeUnit: (unitId: string) => Promise<boolean>;
        distributeGame: (gameId: string, units: string[]) => Promise<boolean>;
      };
      config: {
        get: () => Promise<any>;
        update: (updates: any) => Promise<boolean>;
        isFeatureEnabled: (feature: string) => Promise<boolean>;
      };
      venue: {
        getStatus: () => Promise<{
          venueEnabled: boolean;
          isOpen: boolean;
          override: 'none' | 'force_open';
          closedTitle: string;
          closedSubtitle: string;
        }>;
        setOverride: (password: string, mode: 'none' | 'force_open') => Promise<boolean>;
      };
      health: {
        runChecks: () => Promise<{
          diskFreeMb: number;
          diskOk: boolean;
          networkOk: boolean;
          gamesDirOk: boolean;
          networkLatencyMs: number | null;
          networkError: string | null;
          allPassed: boolean;
          errors: readonly string[];
        }>;
      };
      competition: {
        list: () => Promise<any[]>;
        getActive: (gameId?: string) => Promise<any | null>;
        getLeaderboard: (competitionId: string, limit?: number) => Promise<any[]>;
        create: (password: string, input: {
          name: string;
          gameId: string;
          metric?: 'high_score' | 'fastest_time';
          startsAt?: string;
          endsAt?: string | null;
          seasonId?: string | null;
          bracketEnabled?: boolean;
        }) => Promise<any | null>;
        end: (password: string, competitionId: string) => Promise<boolean>;
        setDisplayName: (displayName: string) => Promise<string>;
        getDisplayName: () => Promise<string>;
        getFlagged: (competitionId?: string) => Promise<any[]>;
        reviewSubmission: (
          password: string,
          submissionId: string,
          decision: 'accepted' | 'rejected'
        ) => Promise<any | null>;
        supportedGames: () => Promise<string[]>;
        venueLeaderboard: (limit?: number) => Promise<any[]>;
        exitGame: () => Promise<boolean>;
        listSchedules: () => Promise<any[]>;
        upsertSchedule: (password: string, schedule: {
          id?: string;
          name: string;
          gameId: string;
          cadence: 'daily' | 'weekly' | 'once';
          startTime: string;
          durationMinutes: number;
          enabled: boolean;
          seasonId?: string | null;
          bracketEnabled?: boolean;
        }) => Promise<any | null>;
        syncNow: (password: string) => Promise<{ pushed: number; pulled: number } | null>;
        syncQueue: () => Promise<any[]>;
        onScoreSubmitted: (callback: (submission: unknown) => void) => () => void;
        onGameExited: (callback: () => void) => () => void;
      };
      player: {
        create: (displayName: string, pin?: string) => Promise<any>;
        list: () => Promise<any[]>;
        get: (playerId: string) => Promise<any | null>;
        identify: (payload: {
          qrPayload?: string;
          playerId?: string;
          pin?: string;
        }) => Promise<any | null>;
        clear: () => Promise<boolean>;
      };
      achievements: {
        list: () => Promise<any[]>;
        unlocks: (playerId?: string) => Promise<any[]>;
      };
      rewards: {
        list: (activeOnly?: boolean) => Promise<any[]>;
        create: (password: string, input: {
          name: string;
          type: 'badge' | 'free_play' | 'coupon' | 'prize';
          description: string;
          requiresStaffApproval: boolean;
          competitionId?: string | null;
        }) => Promise<any | null>;
        request: (
          rewardId: string,
          displayName?: string,
          competitionId?: string | null
        ) => Promise<any | null>;
        redemptions: (
          status?: 'pending' | 'approved' | 'rejected' | 'fulfilled'
        ) => Promise<any[]>;
        review: (
          password: string,
          redemptionId: string,
          decision: 'approved' | 'rejected' | 'fulfilled',
          notes?: string
        ) => Promise<any | null>;
      };
      system: {
        getVersion: () => string;
        getPlatform: () => string;
        getArch: () => string;
      };
    };
  }
}
