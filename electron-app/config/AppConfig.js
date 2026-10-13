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
exports.ConfigManager = exports.defaultConfig = void 0;
const path = __importStar(require("path"));
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
    },
    venue: {
        enabled: false,
        weeklyHours: [
            { start: '10:00', end: '22:00' },
            { start: '10:00', end: '22:00' },
            { start: '10:00', end: '22:00' },
            { start: '10:00', end: '22:00' },
            { start: '10:00', end: '22:00' },
            { start: '10:00', end: '23:00' },
            { start: '10:00', end: '23:00' }
        ],
        closedTitle: 'Sorry, we are closed',
        closedSubtitle: 'Please visit during posted hours. Thank you!'
    },
    healthCheck: {
        enabled: false,
        minFreeDiskMb: 256,
        networkCheckUrl: null,
        pingTimeoutMs: 8000,
        blockPublicUntilPass: false
    },
    accessibility: {
        highContrast: false,
        largeTouchTargets: false,
        reduceMotion: false
    },
    competitions: {
        enabled: true,
        syncEnabled: false,
        syncIntervalMs: 60000,
        hubDir: 'data/competition-hub'
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
    isCompetitionsEnabled() {
        return this.config.competitions.enabled;
    }
    isCompetitionSyncEnabled() {
        return this.config.competitions.enabled && this.config.competitions.syncEnabled;
    }
    setCompetitionSyncEnabled(enabled) {
        this.config = {
            ...this.config,
            competitions: {
                ...this.config.competitions,
                syncEnabled: enabled
            }
        };
    }
    getCompetitionHubDir() {
        const configured = this.config.competitions.hubDir || 'data/competition-hub';
        return path.isAbsolute(configured) ? configured : path.join(process.cwd(), configured);
    }
}
exports.ConfigManager = ConfigManager;
