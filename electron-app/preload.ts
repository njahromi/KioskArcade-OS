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
      system: {
        getVersion: () => string;
        getPlatform: () => string;
        getArch: () => string;
      };
    };
  }
} 