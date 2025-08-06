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
    // System information
    system: {
        getVersion: () => process.versions.electron,
        getPlatform: () => process.platform,
        getArch: () => process.arch
    }
});
