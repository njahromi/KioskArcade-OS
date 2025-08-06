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
    // System information
    system: {
        getVersion: () => process.versions.electron,
        getPlatform: () => process.platform,
        getArch: () => process.arch
    }
});
