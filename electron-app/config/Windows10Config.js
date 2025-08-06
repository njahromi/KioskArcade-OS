"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Windows10ConfigManager = exports.windows10Config = void 0;
exports.windows10Config = {
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
class Windows10ConfigManager extends ConfigManager {
    constructor() {
        super();
        // Override config with Windows 10 specific settings
        this.updateConfig(exports.windows10Config);
    }
    static getInstance() {
        if (!Windows10ConfigManager.instance) {
            Windows10ConfigManager.instance = new Windows10ConfigManager();
        }
        return Windows10ConfigManager.instance;
    }
    // Override methods to ensure compatibility
    getConfig() {
        return super.getConfig();
    }
    updateConfig(updates) {
        super.updateConfig(updates);
    }
    isFeatureEnabled(feature) {
        return super.isFeatureEnabled(feature);
    }
    getArcadeType() {
        return super.getArcadeType();
    }
    isMultiArcadeEnabled() {
        return super.isMultiArcadeEnabled();
    }
    isCloudSyncEnabled() {
        return super.isCloudSyncEnabled();
    }
    isAnalyticsEnabled() {
        return super.isAnalyticsEnabled();
    }
    isMobileAdminEnabled() {
        return super.isMobileAdminEnabled();
    }
    isMultiplayerEnabled() {
        return super.isMultiplayerEnabled();
    }
    // Windows 10 specific methods
    isKioskModeEnabled() {
        return false; // Disabled for Windows 10 testing
    }
    isFullscreenEnabled() {
        return true; // Use fullscreen instead of kiosk mode
    }
    getCompatibilityMode() {
        return 'windows10';
    }
}
exports.Windows10ConfigManager = Windows10ConfigManager;
