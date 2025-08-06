import { AppConfig } from './AppConfig';

export const windows10Config: Partial<AppConfig> = {
  app: {
    name: 'KioskArcade OS',
    version: '2.0.0',
    environment: 'development',
    debug: true
  },
  
  arcade: {
    id: 'ARCADE_WIN10',
    locationId: 'LOC_WIN10',
    locationName: 'Windows 10 Arcade Location',
    type: 'single', // Start with single unit for testing
    maxConcurrentGames: 1,
    autoRestart: true
  },
  
  network: {
    cloudSync: true,
    syncInterval: 60, // 1 hour
    updateCheckInterval: 1440, // 24 hours
    analyticsEnabled: true,
    remoteMonitoring: true,
    pubsubEnabled: true
  },
  
  security: {
    lockdownEnabled: true,
    adminAccessEnabled: true,
    sessionTimeout: 30, // 30 minutes
    encryptionEnabled: true,
    auditLogging: true
  },
  
  display: {
    brightness: 100,
    volume: 80,
    autoStart: true,
    fullscreen: true,
    kioskMode: false // Disable kiosk mode for Windows 10 testing
  },
  
  games: {
    autoUpdate: true,
    cloudDistribution: true,
    localCache: true,
    maxCacheSize: 1024, // 1GB
    multiplayerEnabled: false
  },
  
  analytics: {
    enabled: true,
    endpoint: 'https://analytics.kioskarcade.com',
    batchSize: 100,
    flushInterval: 60, // 1 minute
    trackUserBehavior: true,
    performanceMonitoring: true
  },
  
  mobile: {
    adminAppEnabled: true,
    pushNotifications: true,
    remoteControl: true,
    qrCodeAccess: true
  }
};

export class Windows10ConfigManager extends ConfigManager {
  private static instance: Windows10ConfigManager;
  
  private constructor() {
    super();
    // Override config with Windows 10 specific settings
    this.updateConfig(windows10Config);
  }
  
  static getInstance(): Windows10ConfigManager {
    if (!Windows10ConfigManager.instance) {
      Windows10ConfigManager.instance = new Windows10ConfigManager();
    }
    return Windows10ConfigManager.instance;
  }
  
  // Override methods to ensure compatibility
  getConfig(): AppConfig {
    return super.getConfig();
  }
  
  updateConfig(updates: Partial<AppConfig>): void {
    super.updateConfig(updates);
  }
  
  isFeatureEnabled(feature: keyof AppConfig): boolean {
    return super.isFeatureEnabled(feature);
  }
  
  getArcadeType(): 'single' | 'multi' | 'cluster' {
    return super.getArcadeType();
  }
  
  isMultiArcadeEnabled(): boolean {
    return super.isMultiArcadeEnabled();
  }
  
  isCloudSyncEnabled(): boolean {
    return super.isCloudSyncEnabled();
  }
  
  isAnalyticsEnabled(): boolean {
    return super.isAnalyticsEnabled();
  }
  
  isMobileAdminEnabled(): boolean {
    return super.isMobileAdminEnabled();
  }
  
  isMultiplayerEnabled(): boolean {
    return super.isMultiplayerEnabled();
  }
  
  // Windows 10 specific methods
  isKioskModeEnabled(): boolean {
    return false; // Disabled for Windows 10 testing
  }
  
  isFullscreenEnabled(): boolean {
    return true; // Use fullscreen instead of kiosk mode
  }
  
  getCompatibilityMode(): 'windows10' | 'windows11' {
    return 'windows10';
  }
} 