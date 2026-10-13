"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
/**
 * Minimal guest preload for game BrowserViews.
 * Exposes only score reporting — no Node, no unrestricted IPC.
 */
electron_1.contextBridge.exposeInMainWorld('kioskArcadeGame', {
    reportScore: (payload) => {
        electron_1.ipcRenderer.send('kioskarcade:score', {
            type: 'kioskarcade:score',
            ...payload,
            reportedAt: new Date().toISOString()
        });
    },
    requestExit: () => {
        electron_1.ipcRenderer.send('kioskarcade:exit', {});
    }
});
