import { app, BrowserWindow, BrowserView, ipcMain, globalShortcut, screen } from 'electron';
import * as path from 'path';
import { randomUUID } from 'crypto';
import * as QRCode from 'qrcode';
import { TokenManager } from './services/TokenManager';
import { GameManager } from './services/GameManager';
import { AdminManager } from './services/AdminManager';
import { SecurityManager } from './services/SecurityManager';
import { AnalyticsManager } from './services/AnalyticsManager';
import { MultiArcadeManager } from './services/MultiArcadeManager';
import { VenueScheduleManager } from './services/VenueScheduleManager';
import { BootHealthManager } from './services/BootHealthManager';
import { CompetitionManager } from './services/CompetitionManager';
import { PlayerProfileManager } from './services/PlayerProfileManager';
import { AchievementManager } from './services/AchievementManager';
import { LeaderboardManager } from './services/LeaderboardManager';
import { TournamentScheduler } from './services/TournamentScheduler';
import { CompetitionSyncService } from './services/CompetitionSyncService';
import { RewardManager } from './services/RewardManager';
import { Logger } from './utils/Logger';
import { ConfigManager } from './config/AppConfig';
import type { CreateCompetitionInput, RewardType } from './services/competition/types';

interface KioskArcadeConfig {
  readonly isDevelopment: boolean;
  readonly preloadPath: string;
  readonly gamePreloadPath: string;
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
  private readonly venueScheduleManager: VenueScheduleManager;
  private readonly bootHealthManager: BootHealthManager;
  private readonly competitionManager: CompetitionManager;
  private readonly playerProfileManager: PlayerProfileManager;
  private readonly achievementManager: AchievementManager;
  private readonly leaderboardManager: LeaderboardManager;
  private readonly tournamentScheduler: TournamentScheduler;
  private readonly competitionSyncService: CompetitionSyncService;
  private readonly rewardManager: RewardManager;
  private readonly logger: Logger;
  private readonly configManager: ConfigManager;
  private readonly config: KioskArcadeConfig;
  private gameSessionStartedAt = 0;

  constructor() {
    this.logger = new Logger();
    
    this.configManager = ConfigManager.getInstance();
    
    this.tokenManager = new TokenManager();
    this.gameManager = new GameManager();
    this.adminManager = new AdminManager();
    this.securityManager = new SecurityManager();
    this.analyticsManager = new AnalyticsManager();
    this.multiArcadeManager = new MultiArcadeManager();
    this.venueScheduleManager = new VenueScheduleManager(this.configManager, this.adminManager);
    this.bootHealthManager = new BootHealthManager(this.configManager);
    this.competitionManager = new CompetitionManager(this.analyticsManager);
    this.playerProfileManager = new PlayerProfileManager();
    this.achievementManager = new AchievementManager(this.playerProfileManager);
    this.leaderboardManager = new LeaderboardManager(this.competitionManager);
    this.tournamentScheduler = new TournamentScheduler(this.competitionManager);
    this.competitionSyncService = new CompetitionSyncService(this.competitionManager);
    this.rewardManager = new RewardManager(this.analyticsManager);

    this.config = {
      isDevelopment: process.env.NODE_ENV === 'development',
      preloadPath: path.join(__dirname, 'preload.js'),
      gamePreloadPath: path.join(__dirname, 'game-preload.js'),
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
        this.multiArcadeManager.initialize(),
        this.competitionManager.initialize(),
        this.playerProfileManager.initialize(),
        this.achievementManager.initialize(),
        this.rewardManager.initialize()
      ]);

      const tokenData = await this.tokenManager.getTokenData();
      const arcadeId = tokenData?.arcadeId || this.configManager.getConfig().arcade.id;
      const locationId = tokenData?.locationId || this.configManager.getConfig().arcade.locationId;
      this.competitionManager.setIdentityContext(arcadeId, locationId);
      this.competitionSyncService.setArcadeId(arcadeId);
      this.tournamentScheduler.setOnCompetitionSpawned((competition) => {
        this.competitionSyncService.enqueueCompetition(competition);
        this.mainWindow?.webContents.send('competition:event-spawned', competition);
      });
      this.competitionSyncService.setOnSyncComplete((status) => {
        this.mainWindow?.webContents.send('competition:sync-status', status);
      });

      await this.tournamentScheduler.initialize();
      await this.competitionSyncService.initialize();

      // Refresh mock game HTML so score bridge is present on installed packages
      await this.gameManager.regenerateInstalledMockGames();

      // Setup app event handlers
      this.setupAppEventHandlers();
      
      // Create main window
      await this.createMainWindow();
      
      // Setup IPC handlers
      this.setupIpcHandlers();
      this.setupGameGuestIpc();
      
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
      try {
        this.logger.info('Loading development URL: http://localhost:3000');
        await this.mainWindow.loadURL('http://localhost:3000');
        this.logger.info('Development URL loaded successfully');
      } catch (error) {
        this.logger.error('Failed to load development URL:', error);
        // Fallback to loading the built files
        try {
          this.logger.info('Attempting to load built files as fallback');
          await this.mainWindow.loadFile(path.join(this.config.rendererPath, 'index.html'));
          this.logger.info('Built files loaded successfully');
        } catch (fallbackError) {
          this.logger.error('Failed to load built files:', fallbackError);
        }
      }
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

    // Add debugging for window events
    this.mainWindow.webContents.on('did-start-loading', () => {
      this.logger.info('Window started loading');
    });

    this.mainWindow.webContents.on('did-finish-load', () => {
      this.logger.info('Window finished loading');
    });

    this.mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
      this.logger.error('Window failed to load:', { errorCode, errorDescription, validatedURL });
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
      if (!this.venueScheduleManager.isVenueOpenForPublic()) {
        this.logger.warn(`Game launch blocked (venue closed): ${gameId}`);
        return false;
      }
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

    ipcMain.handle('venue:get-status', async () => {
      return this.venueScheduleManager.getPublicStatus();
    });

    ipcMain.handle(
      'venue:set-override',
      async (_event, payload: { readonly password: string; readonly mode: 'none' | 'force_open' }) => {
        return await this.venueScheduleManager.setOverride(payload.mode, payload.password);
      }
    );

    ipcMain.handle('health:run-checks', async () => {
      return await this.bootHealthManager.runChecks();
    });

    this.setupCompetitionIpcHandlers();
  }

  private setupCompetitionIpcHandlers(): void {
    ipcMain.handle('competition:list', async () => {
      return this.competitionManager.listCompetitions();
    });

    ipcMain.handle('competition:get-active', async (_event, gameId?: string) => {
      return this.competitionManager.getActiveCompetition(gameId);
    });

    ipcMain.handle(
      'competition:get-leaderboard',
      async (_event, payload: { readonly competitionId: string; readonly limit?: number }) => {
        return this.competitionManager.getLeaderboard(payload.competitionId, payload.limit ?? 20);
      }
    );

    ipcMain.handle(
      'competition:create',
      async (
        _event,
        payload: { readonly password: string } & CreateCompetitionInput
      ) => {
        const ok = await this.adminManager.authenticate(payload.password);
        if (!ok) return null;
        const created = await this.competitionManager.createCompetition(payload);
        if (created) {
          this.competitionSyncService.enqueueCompetition(created);
        }
        return created;
      }
    );

    ipcMain.handle(
      'competition:end',
      async (_event, payload: { readonly password: string; readonly competitionId: string }) => {
        const ok = await this.adminManager.authenticate(payload.password);
        if (!ok) return false;
        return this.competitionManager.endCompetition(payload.competitionId);
      }
    );

    ipcMain.handle('competition:set-display-name', async (_event, displayName: string) => {
      return this.competitionManager.setDisplayName(displayName);
    });

    ipcMain.handle('competition:get-display-name', async () => {
      return this.competitionManager.getDisplayName();
    });

    ipcMain.handle('competition:get-flagged', async (_event, competitionId?: string) => {
      return this.competitionManager.getFlaggedSubmissions(competitionId);
    });

    ipcMain.handle(
      'competition:review-submission',
      async (
        _event,
        payload: {
          readonly password: string;
          readonly submissionId: string;
          readonly decision: 'accepted' | 'rejected';
        }
      ) => {
        const ok = await this.adminManager.authenticate(payload.password);
        if (!ok) return null;
        return this.competitionManager.reviewSubmission(payload.submissionId, payload.decision);
      }
    );

    ipcMain.handle('competition:supported-games', async () => {
      return this.competitionManager.getAdapterManager().listSupportedGameIds();
    });

    ipcMain.handle('competition:venue-leaderboard', async (_event, limit?: number) => {
      return this.leaderboardManager.getVenueTopScores(limit ?? 10);
    });

    ipcMain.handle('competition:event-timers', async () => {
      return this.leaderboardManager.getActiveEventTimers();
    });

    ipcMain.handle('competition:upcoming', async (_event, limit?: number) => {
      return this.tournamentScheduler.getUpcomingEvents(limit ?? 5);
    });

    ipcMain.handle('competition:exit-game', async () => {
      await this.closeGameSession();
      return true;
    });

    // Phase 2 — player profiles
    ipcMain.handle(
      'player:create',
      async (_event, payload: { readonly displayName: string; readonly pin?: string }) => {
        try {
          const profile = await this.playerProfileManager.createProfile(
            payload.displayName,
            payload.pin
          );
          this.competitionManager.setPlayerId(profile.id);
          this.competitionManager.setDisplayName(profile.displayName);
          await this.analyticsManager.trackEvent('player_profile_created', 'game_activity', {
            playerId: profile.id
          });
          return { ok: true as const, profile };
        } catch (error) {
          return {
            ok: false as const,
            reason: error instanceof Error ? error.message : 'create_failed'
          };
        }
      }
    );

    ipcMain.handle('player:list', async () => this.playerProfileManager.listProfiles());

    ipcMain.handle('player:get', async (_event, playerId: string) => {
      return this.playerProfileManager.getPublicProfile(playerId);
    });

    ipcMain.handle('player:get-session', async () => {
      const playerId = this.competitionManager.getPlayerId();
      if (!playerId) {
        return {
          player: null,
          displayName: this.competitionManager.getDisplayName()
        };
      }
      return {
        player: this.playerProfileManager.getPublicProfile(playerId),
        displayName: this.competitionManager.getDisplayName()
      };
    });

    ipcMain.handle(
      'player:identify',
      async (_event, payload: { readonly qrPayload?: string; readonly playerId?: string; readonly pin?: string }) => {
        const result = this.playerProfileManager.identify(payload);
        if (!result.ok) {
          return result;
        }
        this.competitionManager.setPlayerId(result.profile.id);
        this.competitionManager.setDisplayName(result.profile.displayName);
        await this.analyticsManager.trackEvent('player_identified', 'game_activity', {
          playerId: result.profile.id
        });
        return result;
      }
    );

    ipcMain.handle('player:clear', async () => {
      this.competitionManager.setPlayerId(null);
      return true;
    });

    ipcMain.handle('player:qr-data-url', async (_event, playerId?: string) => {
      const id = playerId ?? this.competitionManager.getPlayerId();
      if (!id) return null;
      const profile = this.playerProfileManager.getPublicProfile(id);
      if (!profile) return null;
      return QRCode.toDataURL(profile.qrPayload, {
        errorCorrectionLevel: 'M',
        margin: 1,
        width: 240,
        color: { dark: '#0f172a', light: '#ffffff' }
      });
    });

    ipcMain.handle('achievements:list', async () => this.achievementManager.listDefinitions());

    ipcMain.handle('achievements:unlocks', async (_event, playerId?: string) => {
      return this.achievementManager.listUnlocks(playerId);
    });

    ipcMain.handle('achievements:progress', async (_event, playerId?: string) => {
      const id = playerId ?? this.competitionManager.getPlayerId();
      if (!id) return [];
      const profile = this.playerProfileManager.getPublicProfile(id);
      return this.achievementManager.getProgressForPlayer(id, profile?.personalBests ?? {});
    });

    // Phase 3 — schedules & sync
    ipcMain.handle('competition:list-schedules', async () => this.tournamentScheduler.listSchedules());

    ipcMain.handle(
      'competition:upsert-schedule',
      async (
        _event,
        payload: {
          readonly password: string;
          readonly schedule: {
            readonly id?: string;
            readonly name: string;
            readonly gameId: string;
            readonly cadence: 'daily' | 'weekly' | 'once';
            readonly startTime: string;
            readonly durationMinutes: number;
            readonly enabled: boolean;
            readonly seasonId?: string | null;
            readonly bracketEnabled?: boolean;
            readonly weeklyDay?: number;
          };
        }
      ) => {
        const ok = await this.adminManager.authenticate(payload.password);
        if (!ok) return null;
        const id = payload.schedule.id ?? randomUUID();
        const existing = this.tournamentScheduler.listSchedules().find((s) => s.id === id);
        return this.tournamentScheduler.upsertSchedule({
          id,
          name: payload.schedule.name,
          gameId: payload.schedule.gameId,
          cadence: payload.schedule.cadence,
          startTime: payload.schedule.startTime,
          durationMinutes: payload.schedule.durationMinutes,
          enabled: payload.schedule.enabled,
          seasonId: payload.schedule.seasonId ?? null,
          bracketEnabled: payload.schedule.bracketEnabled ?? false,
          weeklyDay: payload.schedule.weeklyDay ?? existing?.weeklyDay ?? 1,
          lastSpawnedDate: existing?.lastSpawnedDate ?? null
        });
      }
    );

    ipcMain.handle(
      'competition:remove-schedule',
      async (_event, payload: { readonly password: string; readonly scheduleId: string }) => {
        const ok = await this.adminManager.authenticate(payload.password);
        if (!ok) return false;
        return this.tournamentScheduler.removeSchedule(payload.scheduleId);
      }
    );

    ipcMain.handle('competition:run-scheduler', async (_event, password: string) => {
      const ok = await this.adminManager.authenticate(password);
      if (!ok) return null;
      return this.tournamentScheduler.tick();
    });

    ipcMain.handle('competition:sync-now', async (_event, password: string) => {
      const ok = await this.adminManager.authenticate(password);
      if (!ok) return null;
      return this.competitionSyncService.syncNow();
    });

    ipcMain.handle('competition:sync-queue', async () => this.competitionSyncService.getQueue());

    ipcMain.handle('competition:sync-status', async () => this.competitionSyncService.getStatus());

    ipcMain.handle(
      'competition:set-sync-enabled',
      async (_event, payload: { readonly password: string; readonly enabled: boolean }) => {
        const ok = await this.adminManager.authenticate(payload.password);
        if (!ok) return null;
        return this.competitionSyncService.setEnabled(payload.enabled);
      }
    );

    // Phase 4 — rewards
    ipcMain.handle('rewards:list', async (_event, activeOnly?: boolean) => {
      return this.rewardManager.listRewards(!!activeOnly);
    });

    ipcMain.handle(
      'rewards:create',
      async (
        _event,
        payload: {
          readonly password: string;
          readonly name: string;
          readonly type: RewardType;
          readonly description: string;
          readonly requiresStaffApproval: boolean;
          readonly competitionId?: string | null;
        }
      ) => {
        const ok = await this.adminManager.authenticate(payload.password);
        if (!ok) return null;
        return this.rewardManager.createReward(payload);
      }
    );

    ipcMain.handle(
      'rewards:request',
      async (
        _event,
        payload: {
          readonly rewardId: string;
          readonly displayName?: string;
          readonly competitionId?: string | null;
        }
      ) => {
        return this.rewardManager.requestRedemption({
          rewardId: payload.rewardId,
          playerId: this.competitionManager.getPlayerId(),
          displayName: payload.displayName ?? this.competitionManager.getDisplayName(),
          competitionId: payload.competitionId
        });
      }
    );

    ipcMain.handle('rewards:redemptions', async (_event, status?: 'pending' | 'approved' | 'rejected' | 'fulfilled') => {
      return this.rewardManager.listRedemptions(status);
    });

    ipcMain.handle(
      'rewards:review',
      async (
        _event,
        payload: {
          readonly password: string;
          readonly redemptionId: string;
          readonly decision: 'approved' | 'rejected' | 'fulfilled';
          readonly notes?: string;
        }
      ) => {
        const ok = await this.adminManager.authenticate(payload.password);
        if (!ok) return null;
        return this.rewardManager.reviewRedemption(
          payload.redemptionId,
          payload.decision,
          'admin',
          payload.notes
        );
      }
    );
  }

  private setupGlobalShortcuts(): void {
    // Block common escape shortcuts; Escape exits an active game session instead.
    const blockedShortcuts = [
      'CommandOrControl+Q',
      'CommandOrControl+W',
      'CommandOrControl+R',
      'F11',
      'F12',
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

    globalShortcut.register('Escape', () => {
      if (this.gameView) {
        void this.closeGameSession();
        return;
      }
      this.logger.warn('Blocked shortcut: Escape');
    });

    this.logger.info('Global shortcuts blocked (Escape exits active game)');
  }

  private async launchGame(gameId: string): Promise<boolean> {
    try {
      if (this.gameView) {
        await this.closeGameSession();
      }

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

      this.competitionManager.startGameSession(gameId);
      this.gameSessionStartedAt = Date.now();

      // Create game view with guest score preload
      this.gameView = new BrowserView({
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
          sandbox: true,
          webSecurity: true,
          allowRunningInsecureContent: false,
          preload: this.config.gamePreloadPath
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
    } catch (error) {
      this.logger.error(`Failed to launch game ${gameId}:`, error);
      this.competitionManager.clearActiveSession();
      return false;
    }
  }

  private setupGameGuestIpc(): void {
    ipcMain.on('kioskarcade:score', (event, payload: unknown) => {
      if (!this.gameView || event.sender !== this.gameView.webContents) {
        return;
      }
      void this.onGuestScore(payload);
    });

    ipcMain.on('kioskarcade:exit', (event) => {
      if (!this.gameView || event.sender !== this.gameView.webContents) {
        return;
      }
      void this.closeGameSession();
    });
  }

  private async processScoreSubmission(
    submission: import('./services/competition/types').ScoreSubmission
  ): Promise<void> {
    if (submission.playerId) {
      await this.playerProfileManager.updatePersonalBest(
        submission.playerId,
        submission.gameId,
        submission.score
      );
      await this.playerProfileManager.recordTournament(
        submission.playerId,
        submission.competitionId
      );
      const unlocks = await this.achievementManager.evaluateSubmission(submission);
      if (unlocks.length > 0) {
        const defs = this.achievementManager.listDefinitions();
        this.mainWindow?.webContents.send(
          'achievements:unlocked',
          unlocks.map((u) => ({
            ...u,
            name: defs.find((d) => d.id === u.achievementId)?.name ?? u.achievementId
          }))
        );
      }
    }
    this.competitionSyncService.enqueueScore(submission);
    this.mainWindow?.webContents.send('competition:score-submitted', submission);
  }

  private async onGuestScore(payload: unknown): Promise<void> {
    const submission = await this.competitionManager.handleScoreEvent(payload);
    if (!submission) return;
    await this.processScoreSubmission(submission);
  }

  private async closeGameSession(): Promise<void> {
    const session = this.competitionManager.getActiveSession();
    const gameId = session?.gameId;

    if (session && !session.finalized) {
      const submission = await this.competitionManager.finalizeSession();
      if (submission) {
        await this.processScoreSubmission(submission);
      }
    }

    if (gameId && this.gameSessionStartedAt > 0) {
      const playTime = Date.now() - this.gameSessionStartedAt;
      await this.analyticsManager.trackGamePlay(gameId, playTime);
    }

    if (this.gameView && this.mainWindow) {
      try {
        this.mainWindow.removeBrowserView(this.gameView);
      } catch {
        // ignore
      }
      try {
        (this.gameView.webContents as unknown as { destroy?: () => void }).destroy?.();
      } catch {
        // ignore
      }
      this.gameView = null;
    }

    this.competitionManager.clearActiveSession();
    this.gameSessionStartedAt = 0;
    this.mainWindow?.webContents.focus();
    this.mainWindow?.webContents.send('competition:game-exited', {});
    this.logger.info('Game session closed');
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