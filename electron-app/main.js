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
const AnalyticsManager_1 = require("./services/AnalyticsManager");
const MultiArcadeManager_1 = require("./services/MultiArcadeManager");
const Logger_1 = require("./utils/Logger");
const AppConfig_1 = require("./config/AppConfig");
class KioskArcadeApp {
    constructor() {
        this.mainWindow = null;
        this.gameView = null;
        this.adminWindow = null;
        this.logger = new Logger_1.Logger();
        this.configManager = AppConfig_1.ConfigManager.getInstance();
        this.tokenManager = new TokenManager_1.TokenManager();
        this.gameManager = new GameManager_1.GameManager();
        this.adminManager = new AdminManager_1.AdminManager();
        this.securityManager = new SecurityManager_1.SecurityManager();
        this.analyticsManager = new AnalyticsManager_1.AnalyticsManager();
        this.multiArcadeManager = new MultiArcadeManager_1.MultiArcadeManager();
        this.config = {
            isDevelopment: process.env.NODE_ENV === 'development',
            preloadPath: path.join(__dirname, 'preload.js'),
            rendererPath: path.join(__dirname, 'renderer')
        };
    }
    async initialize() {
        try {
            // Ensure app is single instance
            const gotTheLock = electron_1.app.requestSingleInstanceLock();
            if (!gotTheLock) {
                electron_1.app.quit();
                return;
            }
            // Initialize services in parallel
            await Promise.all([
                this.tokenManager.initialize(),
                this.gameManager.initialize(),
                this.securityManager.initialize(),
                this.adminManager.initialize(),
                this.analyticsManager.initialize(),
                this.multiArcadeManager.initialize()
            ]);
            // Setup app event handlers
            this.setupAppEventHandlers();
            // Create main window
            await this.createMainWindow();
            // Setup IPC handlers
            this.setupIpcHandlers();
            // Setup global shortcuts (blocked)
            this.setupGlobalShortcuts();
            // Start analytics session
            await this.analyticsManager.startUserSession();
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
        // Check if we're on Windows 10 and adjust window settings accordingly
        const isWindows10 = process.platform === 'win32' && process.getSystemVersion().startsWith('10.');
        const useKioskMode = !isWindows10; // Disable kiosk mode on Windows 10
        this.mainWindow = new electron_1.BrowserWindow({
            width,
            height,
            x: 0,
            y: 0,
            fullscreen: true,
            kiosk: useKioskMode,
            webPreferences: {
                nodeIntegration: false,
                contextIsolation: true,
                sandbox: true,
                preload: this.config.preloadPath,
                webSecurity: true,
                allowRunningInsecureContent: false,
                experimentalFeatures: false
            },
            show: false,
            frame: !useKioskMode, // Show frame on Windows 10 for easier testing
            resizable: !useKioskMode,
            minimizable: !useKioskMode,
            maximizable: !useKioskMode,
            closable: !useKioskMode,
            skipTaskbar: useKioskMode,
            alwaysOnTop: useKioskMode,
            titleBarStyle: useKioskMode ? 'hidden' : 'default',
            autoHideMenuBar: useKioskMode
        });
        // Load the main interface
        if (this.config.isDevelopment) {
            await this.mainWindow.loadURL('http://localhost:3000');
        }
        else {
            await this.mainWindow.loadFile(path.join(this.config.rendererPath, 'index.html'));
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
        electron_1.ipcMain.handle('admin:login', async (_event, password) => {
            return await this.adminManager.authenticate(password);
        });
        electron_1.ipcMain.handle('admin:get-config', async () => {
            return await this.adminManager.getConfiguration();
        });
        electron_1.ipcMain.handle('admin:update-config', async (_event, config) => {
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
        electron_1.ipcMain.handle('game:launch', async (_event, gameId) => {
            const result = await this.launchGame(gameId);
            if (result) {
                await this.analyticsManager.trackEvent('game_launched', 'game_activity', { gameId });
            }
            return result;
        });
        electron_1.ipcMain.handle('game:list', async () => {
            return await this.gameManager.getGameList();
        });
        electron_1.ipcMain.handle('game:update', async (_event, gameId) => {
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
        // Analytics handlers
        electron_1.ipcMain.handle('analytics:get-summary', async () => {
            return await this.analyticsManager.getAnalyticsSummary();
        });
        electron_1.ipcMain.handle('analytics:export-data', async () => {
            return await this.analyticsManager.exportAnalyticsData();
        });
        electron_1.ipcMain.handle('analytics:clear-data', async () => {
            return await this.analyticsManager.clearAnalyticsData();
        });
        // Multi-arcade handlers
        electron_1.ipcMain.handle('multiarcade:get-status', async () => {
            return await this.multiArcadeManager.getClusterStatus();
        });
        electron_1.ipcMain.handle('multiarcade:get-units', async () => {
            return await this.multiArcadeManager.getAllUnitStatuses();
        });
        electron_1.ipcMain.handle('multiarcade:add-unit', async (_event, unit) => {
            return await this.multiArcadeManager.addUnit(unit);
        });
        electron_1.ipcMain.handle('multiarcade:remove-unit', async (_event, unitId) => {
            return await this.multiArcadeManager.removeUnit(unitId);
        });
        electron_1.ipcMain.handle('multiarcade:distribute-game', async (_event, gameId, units) => {
            return await this.multiArcadeManager.distributeGame(gameId, units);
        });
        // Configuration handlers
        electron_1.ipcMain.handle('config:get', async () => {
            return this.configManager.getConfig();
        });
        electron_1.ipcMain.handle('config:update', async (_event, updates) => {
            this.configManager.updateConfig(updates);
            return true;
        });
        electron_1.ipcMain.handle('config:is-feature-enabled', async (_event, feature) => {
            return this.configManager.isFeatureEnabled(feature);
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
            // Check if multi-arcade is enabled and select appropriate unit
            if (this.configManager.isMultiArcadeEnabled()) {
                const loadBalancingResult = await this.multiArcadeManager.selectUnitForGame(gameId);
                if (loadBalancingResult) {
                    this.logger.info(`Selected unit ${loadBalancingResult.targetUnit} for game ${gameId}`);
                }
            }
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
            // Track game play time
            const startTime = Date.now();
            this.gameView.webContents.on('did-navigate', async () => {
                const playTime = Date.now() - startTime;
                await this.analyticsManager.trackGamePlay(gameId, playTime);
            });
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
                preload: this.config.preloadPath
            },
            show: false,
            frame: true,
            resizable: true,
            minimizable: true,
            maximizable: true,
            closable: true
        });
        if (this.config.isDevelopment) {
            await this.adminWindow.loadURL('http://localhost:3000/admin');
        }
        else {
            await this.adminWindow.loadFile(path.join(this.config.rendererPath, 'admin.html'));
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
