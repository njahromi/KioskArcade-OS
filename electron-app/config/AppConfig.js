"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConfigManager = exports.defaultConfig = void 0;
exports.defaultConfig = {
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
class ConfigManager {
    constructor() {
        this.config = exports.defaultConfig;
    }
    static getInstance() {
        if (!ConfigManager.instance) {
            ConfigManager.instance = new ConfigManager();
        }
        return ConfigManager.instance;
    }
    getConfig() {
        return this.config;
    }
    updateConfig(updates) {
        this.config = { ...this.config, ...updates };
    }
    isFeatureEnabled(feature) {
        const featureConfig = this.config[feature];
        if (typeof featureConfig === 'object' && featureConfig !== null) {
            return Object.values(featureConfig).some(value => value === true);
        }
        return false;
    }
    getArcadeType() {
        return this.config.arcade.type;
    }
    isMultiArcadeEnabled() {
        return this.config.arcade.type !== 'single';
    }
    isCloudSyncEnabled() {
        return this.config.network.cloudSync;
    }
    isAnalyticsEnabled() {
        return this.config.analytics.enabled;
    }
    isMobileAdminEnabled() {
        return this.config.mobile.adminAppEnabled;
    }
    isMultiplayerEnabled() {
        return this.config.games.multiplayerEnabled;
    }
}
exports.ConfigManager = ConfigManager;
