import { app, BrowserWindow, BrowserView, ipcMain, globalShortcut, screen } from 'electron';
import * as path from 'path';
import { TokenManager } from './services/TokenManager';
import { GameManager } from './services/GameManager';
import { AdminManager } from './services/AdminManager';
import { SecurityManager } from './services/SecurityManager';
import { AnalyticsManager } from './services/AnalyticsManager';
import { MultiArcadeManager } from './services/MultiArcadeManager';
import { Logger } from './utils/Logger';
import { ConfigManager } from './config/AppConfig';
import { Windows10ConfigManager } from './config/Windows10Config';

interface KioskArcadeConfig {
  readonly isDevelopment: boolean;
  readonly preloadPath: string;
  readonly rendererPath: string;
}

class KioskArcadeApp {
  private mainWindow: BrowserWindow | null = null;
  private gameView: BrowserView | null = null;
  private adminWindow: BrowserWindow | null = null;
  private readonly tokenManager: TokenManager;
  private readonly gameManager: GameManager;
  private readonly adminManager: AdminManager;
  private readonly securityManager: SecurityManager;
  private readonly analyticsManager: AnalyticsManager;
  private readonly multiArcadeManager: MultiArcadeManager;
  private readonly logger: Logger;
  private readonly configManager: ConfigManager | Windows10ConfigManager;
  private readonly config: KioskArcadeConfig;

  constructor() {
    this.logger = new Logger();
    
    // Use Windows 10 specific config if running on Windows 10
    const isWindows10 = process.platform === 'win32' && process.getSystemVersion().startsWith('10.');
    this.configManager = isWindows10 ? Windows10ConfigManager.getInstance() : ConfigManager.getInstance();
    
    this.tokenManager = new TokenManager();
    this.gameManager = new GameManager();
    this.adminManager = new AdminManager();
    this.securityManager = new SecurityManager();
    this.analyticsManager = new AnalyticsManager();
    this.multiArcadeManager = new MultiArcadeManager();
    
    this.config = {
      isDevelopment: process.env.NODE_ENV === 'development',
      preloadPath: path.join(__dirname, 'preload.js'),
      rendererPath: path.join(__dirname, 'renderer')
    };
  }

  async initialize(): Promise<void> {
    try {
      // Ensure app is single instance
      const gotTheLock = app.requestSingleInstanceLock();
      if (!gotTheLock) {
        app.quit();
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
    } catch (error) {
      this.logger.error('Failed to initialize KioskArcade OS:', error);
      app.quit();
    }
  }

  private setupAppEventHandlers(): void {
    app.on('window-all-closed', () => {
      // Prevent app from closing when all windows are closed
      this.logger.info('All windows closed, but app remains running');
    });

    app.on('activate', () => {
      if (this.mainWindow === null) {
        this.createMainWindow();
      }
    });

    app.on('before-quit', (event) => {
      // Prevent accidental quit
      event.preventDefault();
      this.logger.warn('Quit attempt blocked');
    });

    app.on('second-instance', () => {
      // Focus existing window if second instance is launched
      if (this.mainWindow) {
        if (this.mainWindow.isMinimized()) {
          this.mainWindow.restore();
        }
        this.mainWindow.focus();
      }
    });
  }

  private async createMainWindow(): Promise<void> {
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width, height } = primaryDisplay.size;

    // Check if we're on Windows 10 and adjust window settings accordingly
    const isWindows10 = process.platform === 'win32' && process.getSystemVersion().startsWith('10.');
    const useKioskMode = !isWindows10; // Disable kiosk mode on Windows 10
    
    this.mainWindow = new BrowserWindow({
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
    } else {
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

  private setupIpcHandlers(): void {
    // Admin interface handlers
    ipcMain.handle('admin:login', async (_event, password: string) => {
      return await this.adminManager.authenticate(password);
    });

    ipcMain.handle('admin:get-config', async () => {
      return await this.adminManager.getConfiguration();
    });

    ipcMain.handle('admin:update-config', async (_event, config: any) => {
      return await this.adminManager.updateConfiguration(config);
    });

    ipcMain.handle('admin:test-network', async () => {
      return await this.adminManager.testNetworkConnectivity();
    });

    ipcMain.handle('admin:sync-games', async () => {
      return await this.gameManager.syncGames();
    });

    ipcMain.handle('admin:get-logs', async () => {
      return await this.logger.getLogs();
    });

    // Game management handlers
    ipcMain.handle('game:launch', async (_event, gameId: string) => {
      const result = await this.launchGame(gameId);
      if (result) {
        await this.analyticsManager.trackEvent('game_launched', 'game_activity', { gameId });
      }
      return result;
    });

    ipcMain.handle('game:list', async () => {
      return await this.gameManager.getGameList();
    });

    ipcMain.handle('game:update', async (_event, gameId: string) => {
      return await this.gameManager.updateGame(gameId);
    });

    // Token management handlers
    ipcMain.handle('token:get', async () => {
      return await this.tokenManager.getCurrentToken();
    });

    ipcMain.handle('token:rotate', async () => {
      return await this.tokenManager.rotateToken();
    });

    // Security handlers
    ipcMain.handle('security:lockdown', async () => {
      return await this.securityManager.enableLockdown();
    });

    ipcMain.handle('security:status', async () => {
      return await this.securityManager.getStatus();
    });

    // Analytics handlers
    ipcMain.handle('analytics:get-summary', async () => {
      return await this.analyticsManager.getAnalyticsSummary();
    });

    ipcMain.handle('analytics:export-data', async () => {
      return await this.analyticsManager.exportAnalyticsData();
    });

    ipcMain.handle('analytics:clear-data', async () => {
      return await this.analyticsManager.clearAnalyticsData();
    });

    // Multi-arcade handlers
    ipcMain.handle('multiarcade:get-status', async () => {
      return await this.multiArcadeManager.getClusterStatus();
    });

    ipcMain.handle('multiarcade:get-units', async () => {
      return await this.multiArcadeManager.getAllUnitStatuses();
    });

    ipcMain.handle('multiarcade:add-unit', async (_event, unit: any) => {
      return await this.multiArcadeManager.addUnit(unit);
    });

    ipcMain.handle('multiarcade:remove-unit', async (_event, unitId: string) => {
      return await this.multiArcadeManager.removeUnit(unitId);
    });

    ipcMain.handle('multiarcade:distribute-game', async (_event, gameId: string, units: string[]) => {
      return await this.multiArcadeManager.distributeGame(gameId, units);
    });

    // Configuration handlers
    ipcMain.handle('config:get', async () => {
      return this.configManager.getConfig();
    });

    ipcMain.handle('config:update', async (_event, updates: any) => {
      this.configManager.updateConfig(updates);
      return true;
    });

    ipcMain.handle('config:is-feature-enabled', async (_event, feature: string) => {
      return this.configManager.isFeatureEnabled(feature as keyof import('./config/AppConfig').AppConfig);
    });
  }

  private setupGlobalShortcuts(): void {
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
      globalShortcut.register(shortcut, () => {
        this.logger.warn(`Blocked shortcut: ${shortcut}`);
        return false;
      });
    });

    this.logger.info('Global shortcuts blocked');
  }

  private async launchGame(gameId: string): Promise<boolean> {
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
      this.gameView = new BrowserView({
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
    } catch (error) {
      this.logger.error(`Failed to launch game ${gameId}:`, error);
      return false;
    }
  }

  private async showAdminInterface(): Promise<void> {
    if (this.adminWindow) {
      this.adminWindow.focus();
      return;
    }

    this.adminWindow = new BrowserWindow({
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
    } else {
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
app.whenReady().then(async () => {
  const kioskApp = new KioskArcadeApp();
  await kioskApp.initialize();
});

// Quit when all windows are closed (except on macOS)
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
}); 