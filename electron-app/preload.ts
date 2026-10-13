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
    eventTimers: () => ipcRenderer.invoke('competition:event-timers'),
    upcoming: (limit?: number) => ipcRenderer.invoke('competition:upcoming', limit),
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
      weeklyDay?: number;
    }) => ipcRenderer.invoke('competition:upsert-schedule', { password, schedule }),
    removeSchedule: (password: string, scheduleId: string) =>
      ipcRenderer.invoke('competition:remove-schedule', { password, scheduleId }),
    runScheduler: (password: string) => ipcRenderer.invoke('competition:run-scheduler', password),
    syncNow: (password: string) => ipcRenderer.invoke('competition:sync-now', password),
    syncQueue: () => ipcRenderer.invoke('competition:sync-queue'),
    syncStatus: () => ipcRenderer.invoke('competition:sync-status'),
    setSyncEnabled: (password: string, enabled: boolean) =>
      ipcRenderer.invoke('competition:set-sync-enabled', { password, enabled }),
    engagement: () => ipcRenderer.invoke('competition:engagement'),
    onScoreSubmitted: (callback: (submission: unknown) => void) => {
      const listener = (_event: unknown, submission: unknown) => callback(submission);
      ipcRenderer.on('competition:score-submitted', listener);
      return () => ipcRenderer.removeListener('competition:score-submitted', listener);
    },
    onGameExited: (callback: () => void) => {
      const listener = () => callback();
      ipcRenderer.on('competition:game-exited', listener);
      return () => ipcRenderer.removeListener('competition:game-exited', listener);
    },
    onEventSpawned: (callback: (competition: unknown) => void) => {
      const listener = (_event: unknown, competition: unknown) => callback(competition);
      ipcRenderer.on('competition:event-spawned', listener);
      return () => ipcRenderer.removeListener('competition:event-spawned', listener);
    },
    onSyncStatus: (callback: (status: unknown) => void) => {
      const listener = (_event: unknown, status: unknown) => callback(status);
      ipcRenderer.on('competition:sync-status', listener);
      return () => ipcRenderer.removeListener('competition:sync-status', listener);
    }
  },

  player: {
    create: (displayName: string, pin?: string) =>
      ipcRenderer.invoke('player:create', { displayName, pin }),
    list: () => ipcRenderer.invoke('player:list'),
    get: (playerId: string) => ipcRenderer.invoke('player:get', playerId),
    getSession: () => ipcRenderer.invoke('player:get-session'),
    identify: (payload: { qrPayload?: string; playerId?: string; pin?: string }) =>
      ipcRenderer.invoke('player:identify', payload),
    clear: () => ipcRenderer.invoke('player:clear'),
    qrDataUrl: (playerId?: string) => ipcRenderer.invoke('player:qr-data-url', playerId)
  },

  achievements: {
    list: () => ipcRenderer.invoke('achievements:list'),
    unlocks: (playerId?: string) => ipcRenderer.invoke('achievements:unlocks', playerId),
    progress: (playerId?: string) => ipcRenderer.invoke('achievements:progress', playerId),
    onUnlocked: (callback: (unlocks: unknown[]) => void) => {
      const listener = (_event: unknown, unlocks: unknown[]) => callback(unlocks);
      ipcRenderer.on('achievements:unlocked', listener);
      return () => ipcRenderer.removeListener('achievements:unlocked', listener);
    }
  },

  rewards: {
    list: (activeOnly?: boolean) => ipcRenderer.invoke('rewards:list', activeOnly),
    create: (password: string, input: {
      name: string;
      type: 'badge' | 'free_play' | 'coupon' | 'prize';
      description: string;
      requiresStaffApproval: boolean;
      competitionId?: string | null;
      seasonId?: string | null;
      autoGrantTopN?: number | null;
    }) => ipcRenderer.invoke('rewards:create', { password, ...input }),
    setActive: (password: string, rewardId: string, active: boolean) =>
      ipcRenderer.invoke('rewards:set-active', { password, rewardId, active }),
    request: (rewardId: string, displayName?: string, competitionId?: string | null) =>
      ipcRenderer.invoke('rewards:request', { rewardId, displayName, competitionId }),
    redemptions: (status?: 'pending' | 'approved' | 'rejected' | 'fulfilled') =>
      ipcRenderer.invoke('rewards:redemptions', status),
    mine: () => ipcRenderer.invoke('rewards:mine'),
    audit: (limit?: number) => ipcRenderer.invoke('rewards:audit', limit),
    review: (
      password: string,
      redemptionId: string,
      decision: 'approved' | 'rejected' | 'fulfilled',
      notes?: string
    ) => ipcRenderer.invoke('rewards:review', { password, redemptionId, decision, notes })
  },

  season: {
    list: () => ipcRenderer.invoke('season:list'),
    getActive: () => ipcRenderer.invoke('season:get-active'),
    standings: (seasonId: string) => ipcRenderer.invoke('season:standings', seasonId),
    create: (password: string, input: {
      name: string;
      description?: string;
      startsAt?: string;
      endsAt?: string | null;
    }) => ipcRenderer.invoke('season:create', { password, ...input }),
    end: (password: string, seasonId: string) =>
      ipcRenderer.invoke('season:end', { password, seasonId })
  },

  bracket: {
    list: (competitionId?: string) => ipcRenderer.invoke('bracket:list', competitionId),
    get: (bracketId: string) => ipcRenderer.invoke('bracket:get', bracketId),
    create: (password: string, competitionId: string, size?: number, name?: string) =>
      ipcRenderer.invoke('bracket:create', { password, competitionId, size, name })
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
        eventTimers: () => Promise<any[]>;
        upcoming: (limit?: number) => Promise<any[]>;
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
          weeklyDay?: number;
        }) => Promise<any | null>;
        removeSchedule: (password: string, scheduleId: string) => Promise<boolean>;
        runScheduler: (password: string) => Promise<any[] | null>;
        syncNow: (password: string) => Promise<{ pushed: number; pulled: number } | null>;
        syncQueue: () => Promise<any[]>;
        syncStatus: () => Promise<any>;
        setSyncEnabled: (password: string, enabled: boolean) => Promise<any | null>;
        engagement: () => Promise<any>;
        onScoreSubmitted: (callback: (submission: unknown) => void) => () => void;
        onGameExited: (callback: () => void) => () => void;
        onEventSpawned: (callback: (competition: unknown) => void) => () => void;
        onSyncStatus: (callback: (status: unknown) => void) => () => void;
      };
      player: {
        create: (
          displayName: string,
          pin?: string
        ) => Promise<{ ok: true; profile: any } | { ok: false; reason: string }>;
        list: () => Promise<any[]>;
        get: (playerId: string) => Promise<any | null>;
        getSession: () => Promise<{ player: any | null; displayName: string }>;
        identify: (payload: {
          qrPayload?: string;
          playerId?: string;
          pin?: string;
        }) => Promise<{ ok: true; profile: any } | { ok: false; reason: string }>;
        clear: () => Promise<boolean>;
        qrDataUrl: (playerId?: string) => Promise<string | null>;
      };
      achievements: {
        list: () => Promise<any[]>;
        unlocks: (playerId?: string) => Promise<any[]>;
        progress: (playerId?: string) => Promise<any[]>;
        onUnlocked: (callback: (unlocks: unknown[]) => void) => () => void;
      };
      rewards: {
        list: (activeOnly?: boolean) => Promise<any[]>;
        create: (password: string, input: {
          name: string;
          type: 'badge' | 'free_play' | 'coupon' | 'prize';
          description: string;
          requiresStaffApproval: boolean;
          competitionId?: string | null;
          seasonId?: string | null;
          autoGrantTopN?: number | null;
        }) => Promise<any | null>;
        setActive: (password: string, rewardId: string, active: boolean) => Promise<any | null>;
        request: (
          rewardId: string,
          displayName?: string,
          competitionId?: string | null
        ) => Promise<any | null>;
        redemptions: (
          status?: 'pending' | 'approved' | 'rejected' | 'fulfilled'
        ) => Promise<any[]>;
        mine: () => Promise<any[]>;
        audit: (limit?: number) => Promise<any[]>;
        review: (
          password: string,
          redemptionId: string,
          decision: 'approved' | 'rejected' | 'fulfilled',
          notes?: string
        ) => Promise<any | null>;
      };
      season: {
        list: () => Promise<any[]>;
        getActive: () => Promise<any | null>;
        standings: (seasonId: string) => Promise<any[]>;
        create: (password: string, input: {
          name: string;
          description?: string;
          startsAt?: string;
          endsAt?: string | null;
        }) => Promise<any | null>;
        end: (password: string, seasonId: string) => Promise<any | null>;
      };
      bracket: {
        list: (competitionId?: string) => Promise<any[]>;
        get: (bracketId: string) => Promise<any | null>;
        create: (
          password: string,
          competitionId: string,
          size?: number,
          name?: string
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
