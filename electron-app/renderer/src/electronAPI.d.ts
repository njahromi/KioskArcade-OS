/** Mirrors competition-related APIs exposed by electron-app/preload.ts */
interface Window {
  electronAPI: {
    admin: {
      login: (password: string) => Promise<boolean>;
      getConfig: () => Promise<unknown>;
      updateConfig: (config: unknown) => Promise<boolean>;
      testNetwork: () => Promise<unknown>;
      syncGames: () => Promise<boolean>;
      getLogs: () => Promise<string[]>;
    };
    game: {
      launch: (gameId: string) => Promise<boolean>;
      list: () => Promise<any[]>;
      update: (gameId: string) => Promise<boolean>;
    };
    token: {
      get: () => Promise<any>;
      rotate: () => Promise<boolean>;
    };
    security: {
      lockdown: () => Promise<boolean>;
      status: () => Promise<unknown>;
    };
    analytics: {
      getSummary: () => Promise<unknown>;
      exportData: () => Promise<unknown>;
      clearData: () => Promise<boolean>;
    };
    multiArcade: {
      getStatus: () => Promise<unknown>;
      getUnits: () => Promise<unknown[]>;
      addUnit: (unit: unknown) => Promise<boolean>;
      removeUnit: (unitId: string) => Promise<boolean>;
      distributeGame: (gameId: string, units: string[]) => Promise<boolean>;
    };
    config: {
      get: () => Promise<any>;
      update: (updates: unknown) => Promise<boolean>;
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
      create: (
        password: string,
        input: {
          name: string;
          gameId: string;
          metric?: 'high_score' | 'fastest_time';
          startsAt?: string;
          endsAt?: string | null;
          seasonId?: string | null;
          bracketEnabled?: boolean;
        }
      ) => Promise<any | null>;
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
      upsertSchedule: (
        password: string,
        schedule: {
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
        }
      ) => Promise<any | null>;
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
      create: (
        password: string,
        input: {
          name: string;
          type: 'badge' | 'free_play' | 'coupon' | 'prize';
          description: string;
          requiresStaffApproval: boolean;
          competitionId?: string | null;
          seasonId?: string | null;
          autoGrantTopN?: number | null;
        }
      ) => Promise<any | null>;
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
      create: (
        password: string,
        input: {
          name: string;
          description?: string;
          startsAt?: string;
          endsAt?: string | null;
        }
      ) => Promise<any | null>;
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
