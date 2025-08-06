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
      system: {
        getVersion: () => string;
        getPlatform: () => string;
        getArch: () => string;
      };
    };
  }
} 