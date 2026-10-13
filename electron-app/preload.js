"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
electron_1.contextBridge.exposeInMainWorld('electronAPI', {
    // Admin interface methods
    admin: {
        login: (password) => electron_1.ipcRenderer.invoke('admin:login', password),
        getConfig: () => electron_1.ipcRenderer.invoke('admin:get-config'),
        updateConfig: (config) => electron_1.ipcRenderer.invoke('admin:update-config', config),
        testNetwork: () => electron_1.ipcRenderer.invoke('admin:test-network'),
        syncGames: () => electron_1.ipcRenderer.invoke('admin:sync-games'),
        getLogs: () => electron_1.ipcRenderer.invoke('admin:get-logs')
    },
    // Game management methods
    game: {
        launch: (gameId) => electron_1.ipcRenderer.invoke('game:launch', gameId),
        list: () => electron_1.ipcRenderer.invoke('game:list'),
        update: (gameId) => electron_1.ipcRenderer.invoke('game:update', gameId)
    },
    // Token management methods
    token: {
        get: () => electron_1.ipcRenderer.invoke('token:get'),
        rotate: () => electron_1.ipcRenderer.invoke('token:rotate')
    },
    // Security methods
    security: {
        lockdown: () => electron_1.ipcRenderer.invoke('security:lockdown'),
        status: () => electron_1.ipcRenderer.invoke('security:status')
    },
    // Analytics methods
    analytics: {
        getSummary: () => electron_1.ipcRenderer.invoke('analytics:get-summary'),
        exportData: () => electron_1.ipcRenderer.invoke('analytics:export-data'),
        clearData: () => electron_1.ipcRenderer.invoke('analytics:clear-data')
    },
    // Multi-arcade management methods
    multiArcade: {
        getStatus: () => electron_1.ipcRenderer.invoke('multiarcade:get-status'),
        getUnits: () => electron_1.ipcRenderer.invoke('multiarcade:get-units'),
        addUnit: (unit) => electron_1.ipcRenderer.invoke('multiarcade:add-unit', unit),
        removeUnit: (unitId) => electron_1.ipcRenderer.invoke('multiarcade:remove-unit', unitId),
        distributeGame: (gameId, units) => electron_1.ipcRenderer.invoke('multiarcade:distribute-game', gameId, units)
    },
    // Configuration methods
    config: {
        get: () => electron_1.ipcRenderer.invoke('config:get'),
        update: (updates) => electron_1.ipcRenderer.invoke('config:update', updates),
        isFeatureEnabled: (feature) => electron_1.ipcRenderer.invoke('config:is-feature-enabled', feature)
    },
    venue: {
        getStatus: () => electron_1.ipcRenderer.invoke('venue:get-status'),
        setOverride: (password, mode) => electron_1.ipcRenderer.invoke('venue:set-override', { password, mode })
    },
    health: {
        runChecks: () => electron_1.ipcRenderer.invoke('health:run-checks')
    },
    competition: {
        list: () => electron_1.ipcRenderer.invoke('competition:list'),
        getActive: (gameId) => electron_1.ipcRenderer.invoke('competition:get-active', gameId),
        getLeaderboard: (competitionId, limit) => electron_1.ipcRenderer.invoke('competition:get-leaderboard', { competitionId, limit }),
        create: (password, input) => electron_1.ipcRenderer.invoke('competition:create', { password, ...input }),
        end: (password, competitionId) => electron_1.ipcRenderer.invoke('competition:end', { password, competitionId }),
        setDisplayName: (displayName) => electron_1.ipcRenderer.invoke('competition:set-display-name', displayName),
        getDisplayName: () => electron_1.ipcRenderer.invoke('competition:get-display-name'),
        getFlagged: (competitionId) => electron_1.ipcRenderer.invoke('competition:get-flagged', competitionId),
        reviewSubmission: (password, submissionId, decision) => electron_1.ipcRenderer.invoke('competition:review-submission', { password, submissionId, decision }),
        supportedGames: () => electron_1.ipcRenderer.invoke('competition:supported-games'),
        venueLeaderboard: (limit) => electron_1.ipcRenderer.invoke('competition:venue-leaderboard', limit),
        eventTimers: () => electron_1.ipcRenderer.invoke('competition:event-timers'),
        upcoming: (limit) => electron_1.ipcRenderer.invoke('competition:upcoming', limit),
        exitGame: () => electron_1.ipcRenderer.invoke('competition:exit-game'),
        listSchedules: () => electron_1.ipcRenderer.invoke('competition:list-schedules'),
        upsertSchedule: (password, schedule) => electron_1.ipcRenderer.invoke('competition:upsert-schedule', { password, schedule }),
        removeSchedule: (password, scheduleId) => electron_1.ipcRenderer.invoke('competition:remove-schedule', { password, scheduleId }),
        runScheduler: (password) => electron_1.ipcRenderer.invoke('competition:run-scheduler', password),
        syncNow: (password) => electron_1.ipcRenderer.invoke('competition:sync-now', password),
        syncQueue: () => electron_1.ipcRenderer.invoke('competition:sync-queue'),
        syncStatus: () => electron_1.ipcRenderer.invoke('competition:sync-status'),
        setSyncEnabled: (password, enabled) => electron_1.ipcRenderer.invoke('competition:set-sync-enabled', { password, enabled }),
        onScoreSubmitted: (callback) => {
            const listener = (_event, submission) => callback(submission);
            electron_1.ipcRenderer.on('competition:score-submitted', listener);
            return () => electron_1.ipcRenderer.removeListener('competition:score-submitted', listener);
        },
        onGameExited: (callback) => {
            const listener = () => callback();
            electron_1.ipcRenderer.on('competition:game-exited', listener);
            return () => electron_1.ipcRenderer.removeListener('competition:game-exited', listener);
        },
        onEventSpawned: (callback) => {
            const listener = (_event, competition) => callback(competition);
            electron_1.ipcRenderer.on('competition:event-spawned', listener);
            return () => electron_1.ipcRenderer.removeListener('competition:event-spawned', listener);
        },
        onSyncStatus: (callback) => {
            const listener = (_event, status) => callback(status);
            electron_1.ipcRenderer.on('competition:sync-status', listener);
            return () => electron_1.ipcRenderer.removeListener('competition:sync-status', listener);
        }
    },
    player: {
        create: (displayName, pin) => electron_1.ipcRenderer.invoke('player:create', { displayName, pin }),
        list: () => electron_1.ipcRenderer.invoke('player:list'),
        get: (playerId) => electron_1.ipcRenderer.invoke('player:get', playerId),
        getSession: () => electron_1.ipcRenderer.invoke('player:get-session'),
        identify: (payload) => electron_1.ipcRenderer.invoke('player:identify', payload),
        clear: () => electron_1.ipcRenderer.invoke('player:clear'),
        qrDataUrl: (playerId) => electron_1.ipcRenderer.invoke('player:qr-data-url', playerId)
    },
    achievements: {
        list: () => electron_1.ipcRenderer.invoke('achievements:list'),
        unlocks: (playerId) => electron_1.ipcRenderer.invoke('achievements:unlocks', playerId),
        progress: (playerId) => electron_1.ipcRenderer.invoke('achievements:progress', playerId),
        onUnlocked: (callback) => {
            const listener = (_event, unlocks) => callback(unlocks);
            electron_1.ipcRenderer.on('achievements:unlocked', listener);
            return () => electron_1.ipcRenderer.removeListener('achievements:unlocked', listener);
        }
    },
    rewards: {
        list: (activeOnly) => electron_1.ipcRenderer.invoke('rewards:list', activeOnly),
        create: (password, input) => electron_1.ipcRenderer.invoke('rewards:create', { password, ...input }),
        request: (rewardId, displayName, competitionId) => electron_1.ipcRenderer.invoke('rewards:request', { rewardId, displayName, competitionId }),
        redemptions: (status) => electron_1.ipcRenderer.invoke('rewards:redemptions', status),
        review: (password, redemptionId, decision, notes) => electron_1.ipcRenderer.invoke('rewards:review', { password, redemptionId, decision, notes })
    },
    // System information
    system: {
        getVersion: () => process.versions.electron,
        getPlatform: () => process.platform,
        getArch: () => process.arch
    }
});
