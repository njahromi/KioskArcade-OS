import { contextBridge, ipcRenderer } from 'electron';

/**
 * Minimal guest preload for game BrowserViews.
 * Exposes only score reporting — no Node, no unrestricted IPC.
 */
contextBridge.exposeInMainWorld('kioskArcadeGame', {
  reportScore: (payload: {
    readonly gameId: string;
    readonly score: number;
    readonly event: 'update' | 'final';
    readonly progress?: {
      readonly level?: number;
      readonly elapsedMs?: number;
      readonly completed?: boolean;
      readonly lines?: number;
      readonly length?: number;
    } | null;
  }) => {
    ipcRenderer.send('kioskarcade:score', {
      type: 'kioskarcade:score',
      ...payload,
      reportedAt: new Date().toISOString()
    });
  },
  requestExit: () => {
    ipcRenderer.send('kioskarcade:exit', {});
  }
});

declare global {
  interface Window {
    kioskArcadeGame?: {
      reportScore: (payload: {
        readonly gameId: string;
        readonly score: number;
        readonly event: 'update' | 'final';
        readonly progress?: {
          readonly level?: number;
          readonly elapsedMs?: number;
          readonly completed?: boolean;
          readonly lines?: number;
          readonly length?: number;
        } | null;
      }) => void;
      requestExit: () => void;
    };
  }
}
