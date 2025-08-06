"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const path = __importStar(require("path"));
const TokenManager_1 = require("./services/TokenManager");
const GameManager_1 = require("./services/GameManager");
const AdminManager_1 = require("./services/AdminManager");
const SecurityManager_1 = require("./services/SecurityManager");
const Logger_1 = require("./utils/Logger");
class KioskArcadeApp {
    constructor() {
        this.mainWindow = null;
        this.gameView = null;
        this.adminWindow = null;
        this.logger = new Logger_1.Logger();
        this.tokenManager = new TokenManager_1.TokenManager();
        this.gameManager = new GameManager_1.GameManager();
        this.adminManager = new AdminManager_1.AdminManager();
        this.securityManager = new SecurityManager_1.SecurityManager();
    }
    async initialize() {
        try {
            // Ensure app is single instance
            const gotTheLock = electron_1.app.requestSingleInstanceLock();
            if (!gotTheLock) {
                electron_1.app.quit();
                return;
            }
            // Initialize services
            await this.tokenManager.initialize();
            await this.gameManager.initialize();
            await this.securityManager.initialize();
            // Setup app event handlers
            this.setupAppEventHandlers();
            // Create main window
            await this.createMainWindow();
            // Setup IPC handlers
            this.setupIpcHandlers();
            // Setup global shortcuts (blocked)
            this.setupGlobalShortcuts();
            this.logger.info('KioskArcade OS initialized successfully');
        }
        catch (error) {
            this.logger.error('Failed to initialize KioskArcade OS:', error);
            electron_1.app.quit();
        }
    }
    setupAppEventHandlers() {
        electron_1.app.on('window-all-closed', () => {
            // Prevent app from closing when all windows are closed
            this.logger.info('All windows closed, but app remains running');
        });
        electron_1.app.on('activate', () => {
            if (this.mainWindow === null) {
                this.createMainWindow();
            }
        });
        electron_1.app.on('before-quit', (event) => {
            // Prevent accidental quit
            event.preventDefault();
            this.logger.warn('Quit attempt blocked');
        });
        electron_1.app.on('second-instance', () => {
            // Focus existing window if second instance is launched
            if (this.mainWindow) {
                if (this.mainWindow.isMinimized()) {
                    this.mainWindow.restore();
                }
                this.mainWindow.focus();
            }
        });
    }
    async createMainWindow() {
        const primaryDisplay = electron_1.screen.getPrimaryDisplay();
        const { width, height } = primaryDisplay.size;
        this.mainWindow = new electron_1.BrowserWindow({
            width,
            height,
            x: 0,
            y: 0,
            fullscreen: true,
            kiosk: true,
            webPreferences: {
                nodeIntegration: false,
                contextIsolation: true,
                sandbox: true,
                preload: path.join(__dirname, 'preload.js'),
                webSecurity: true,
                allowRunningInsecureContent: false,
                experimentalFeatures: false
            },
            show: false,
            frame: false,
            resizable: false,
            minimizable: false,
            maximizable: false,
            closable: false,
            skipTaskbar: true,
            alwaysOnTop: true,
            titleBarStyle: 'hidden',
            autoHideMenuBar: true
        });
        // Load the main interface
        if (process.env.NODE_ENV === 'development') {
            await this.mainWindow.loadURL('http://localhost:3000');
        }
        else {
            await this.mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
        }
        // Prevent window from being closed
        this.mainWindow.on('close', (event) => {
            event.preventDefault();
            this.logger.warn('Window close attempt blocked');
        });
        // Prevent window from being resized
        this.mainWindow.on('resize', () => {
            this.mainWindow?.setFullScreen(true);
        });
        // Show window when ready
        this.mainWindow.once('ready-to-show', () => {
            this.mainWindow?.show();
            this.logger.info('Main window ready');
        });
        // Handle window focus
        this.mainWindow.on('blur', () => {
            this.mainWindow?.focus();
        });
    }
    setupIpcHandlers() {
        // Admin interface handlers
        electron_1.ipcMain.handle('admin:login', async (event, password) => {
            return await this.adminManager.authenticate(password);
        });
        electron_1.ipcMain.handle('admin:get-config', async () => {
            return await this.adminManager.getConfiguration();
        });
        electron_1.ipcMain.handle('admin:update-config', async (event, config) => {
            return await this.adminManager.updateConfiguration(config);
        });
        electron_1.ipcMain.handle('admin:test-network', async () => {
            return await this.adminManager.testNetworkConnectivity();
        });
        electron_1.ipcMain.handle('admin:sync-games', async () => {
            return await this.gameManager.syncGames();
        });
        electron_1.ipcMain.handle('admin:get-logs', async () => {
            return await this.logger.getLogs();
        });
        // Game management handlers
        electron_1.ipcMain.handle('game:launch', async (event, gameId) => {
            return await this.launchGame(gameId);
        });
        electron_1.ipcMain.handle('game:list', async () => {
            return await this.gameManager.getGameList();
        });
        electron_1.ipcMain.handle('game:update', async (event, gameId) => {
            return await this.gameManager.updateGame(gameId);
        });
        // Token management handlers
        electron_1.ipcMain.handle('token:get', async () => {
            return await this.tokenManager.getCurrentToken();
        });
        electron_1.ipcMain.handle('token:rotate', async () => {
            return await this.tokenManager.rotateToken();
        });
        // Security handlers
        electron_1.ipcMain.handle('security:lockdown', async () => {
            return await this.securityManager.enableLockdown();
        });
        electron_1.ipcMain.handle('security:status', async () => {
            return await this.securityManager.getStatus();
        });
    }
    setupGlobalShortcuts() {
        // Block all common escape shortcuts
        const blockedShortcuts = [
            'CommandOrControl+Q',
            'CommandOrControl+W',
            'CommandOrControl+R',
            'F11',
            'F12',
            'Escape',
            'Alt+F4',
            'Alt+Tab',
            'CommandOrControl+Alt+Delete',
            'CommandOrControl+Shift+Esc'
        ];
        blockedShortcuts.forEach(shortcut => {
            electron_1.globalShortcut.register(shortcut, () => {
                this.logger.warn(`Blocked shortcut: ${shortcut}`);
                return false;
            });
        });
        this.logger.info('Global shortcuts blocked');
    }
    async launchGame(gameId) {
        try {
            const gamePath = await this.gameManager.getGamePath(gameId);
            if (!gamePath) {
                throw new Error(`Game ${gameId} not found`);
            }
            // Create game view
            this.gameView = new electron_1.BrowserView({
                webPreferences: {
                    nodeIntegration: false,
                    contextIsolation: true,
                    sandbox: true,
                    webSecurity: true,
                    allowRunningInsecureContent: false
                }
            });
            // Set game view bounds to full screen
            const bounds = this.mainWindow?.getBounds();
            if (bounds) {
                this.gameView.setBounds(bounds);
                this.gameView.setAutoResize({ width: true, height: true });
            }
            // Add game view to main window
            this.mainWindow?.addBrowserView(this.gameView);
            // Load game
            await this.gameView.webContents.loadFile(gamePath);
            // Focus game view
            this.gameView.webContents.focus();
            this.logger.info(`Game ${gameId} launched successfully`);
            return true;
        }
        catch (error) {
            this.logger.error(`Failed to launch game ${gameId}:`, error);
            return false;
        }
    }
    async showAdminInterface() {
        if (this.adminWindow) {
            this.adminWindow.focus();
            return;
        }
        this.adminWindow = new electron_1.BrowserWindow({
            width: 1200,
            height: 800,
            webPreferences: {
                nodeIntegration: false,
                contextIsolation: true,
                sandbox: true,
                preload: path.join(__dirname, 'preload.js')
            },
            show: false,
            frame: true,
            resizable: true,
            minimizable: true,
            maximizable: true,
            closable: true
        });
        if (process.env.NODE_ENV === 'development') {
            await this.adminWindow.loadURL('http://localhost:3000/admin');
        }
        else {
            await this.adminWindow.loadFile(path.join(__dirname, 'renderer', 'admin.html'));
        }
        this.adminWindow.once('ready-to-show', () => {
            this.adminWindow?.show();
        });
        this.adminWindow.on('closed', () => {
            this.adminWindow = null;
        });
    }
}
// Initialize app when Electron is ready
electron_1.app.whenReady().then(async () => {
    const kioskApp = new KioskArcadeApp();
    await kioskApp.initialize();
});
// Quit when all windows are closed (except on macOS)
electron_1.app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        electron_1.app.quit();
    }
});
