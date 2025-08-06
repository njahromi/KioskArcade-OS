export interface AppConfig {
  readonly app: {
    readonly name: string;
    readonly version: string;
    readonly environment: 'development' | 'production' | 'staging';
    readonly debug: boolean;
  };
  
  readonly arcade: {
    readonly id: string;
    readonly locationId: string;
    readonly locationName: string;
    readonly type: 'single' | 'multi' | 'cluster';
    readonly maxConcurrentGames: number;
    readonly autoRestart: boolean;
  };
  
  readonly network: {
    readonly cloudSync: boolean;
    readonly syncInterval: number; // minutes
    readonly updateCheckInterval: number; // minutes
    readonly analyticsEnabled: boolean;
    readonly remoteMonitoring: boolean;
    readonly pubsubEnabled: boolean;
  };
  
  readonly security: {
    readonly lockdownEnabled: boolean;
    readonly adminAccessEnabled: boolean;
    readonly sessionTimeout: number; // minutes
    readonly encryptionEnabled: boolean;
    readonly auditLogging: boolean;
  };
  
  readonly display: {
    readonly brightness: number; // 0-100
    readonly volume: number; // 0-100
    readonly autoStart: boolean;
    readonly fullscreen: boolean;
    readonly kioskMode: boolean;
  };
  
  readonly games: {
    readonly autoUpdate: boolean;
    readonly cloudDistribution: boolean;
    readonly localCache: boolean;
    readonly maxCacheSize: number; // MB
    readonly multiplayerEnabled: boolean;
  };
  
  readonly analytics: {
    readonly enabled: boolean;
    readonly endpoint: string;
    readonly batchSize: number;
    readonly flushInterval: number; // seconds
    readonly trackUserBehavior: boolean;
    readonly performanceMonitoring: boolean;
  };
  
  readonly mobile: {
    readonly adminAppEnabled: boolean;
    readonly pushNotifications: boolean;
    readonly remoteControl: boolean;
    readonly qrCodeAccess: boolean;
  };
}

export const defaultConfig: AppConfig = {
  app: {
    name: 'KioskArcade OS',
    version: '2.0.0',
    environment: 'development',
    debug: true
  },
  
  arcade: {
    id: 'ARCADE_DEFAULT',
    locationId: 'LOC_DEFAULT',
    locationName: 'Default Arcade Location',
    type: 'single',
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
    kioskMode: true
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

export class ConfigManager {
  private static instance: ConfigManager;
  private config: AppConfig = defaultConfig;
  
  private constructor() {}
  
  static getInstance(): ConfigManager {
    if (!ConfigManager.instance) {
      ConfigManager.instance = new ConfigManager();
    }
    return ConfigManager.instance;
  }
  
  getConfig(): AppConfig {
    return this.config;
  }
  
  updateConfig(updates: Partial<AppConfig>): void {
    this.config = { ...this.config, ...updates };
  }
  
  isFeatureEnabled(feature: keyof AppConfig): boolean {
    const featureConfig = this.config[feature];
    if (typeof featureConfig === 'object' && featureConfig !== null) {
      return Object.values(featureConfig).some(value => value === true);
    }
    return false;
  }
  
  getArcadeType(): 'single' | 'multi' | 'cluster' {
    return this.config.arcade.type;
  }
  
  isMultiArcadeEnabled(): boolean {
    return this.config.arcade.type !== 'single';
  }
  
  isCloudSyncEnabled(): boolean {
    return this.config.network.cloudSync;
  }
  
  isAnalyticsEnabled(): boolean {
    return this.config.analytics.enabled;
  }
  
  isMobileAdminEnabled(): boolean {
    return this.config.mobile.adminAppEnabled;
  }
  
  isMultiplayerEnabled(): boolean {
    return this.config.games.multiplayerEnabled;
  }
} 