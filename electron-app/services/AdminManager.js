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
exports.AdminManager = void 0;
const fs = __importStar(require("fs-extra"));
const path = __importStar(require("path"));
const bcrypt = __importStar(require("bcryptjs"));
const Logger_1 = require("../utils/Logger");
class AdminManager {
    constructor() {
        this.config = null;
        this.defaultPassword = 'admin123'; // In production, this would be set during setup
        this.logger = new Logger_1.Logger();
        this.configPath = path.join(process.cwd(), 'data', 'config.json');
    }
    async initialize() {
        try {
            await fs.ensureDir(path.dirname(this.configPath));
            await this.loadOrCreateConfig();
            this.logger.info('AdminManager initialized successfully');
        }
        catch (error) {
            this.logger.error('Failed to initialize AdminManager:', error);
            throw error;
        }
    }
    async loadOrCreateConfig() {
        try {
            if (await fs.pathExists(this.configPath)) {
                this.config = await fs.readJson(this.configPath);
                this.logger.info('Loaded existing configuration');
            }
            else {
                await this.createDefaultConfig();
                this.logger.info('Created default configuration');
            }
        }
        catch (error) {
            this.logger.error('Failed to load config, creating default:', error);
            await this.createDefaultConfig();
        }
    }
    async createDefaultConfig() {
        this.config = {
            arcadeId: 'ARCADE_' + Math.random().toString(36).substring(2, 8).toUpperCase(),
            locationId: 'LOC_' + Math.random().toString(36).substring(2, 8).toUpperCase(),
            locationName: 'Default Arcade Location',
            adminPassword: await bcrypt.hash(this.defaultPassword, 10),
            networkSettings: {
                autoSync: true,
                syncInterval: 60, // 1 hour
                updateCheckInterval: 1440 // 24 hours
            },
            displaySettings: {
                brightness: 100,
                volume: 80,
                autoStart: true
            },
            securitySettings: {
                lockdownEnabled: true,
                allowAdminAccess: true,
                sessionTimeout: 30 // 30 minutes
            }
        };
        await this.saveConfig();
    }
    async saveConfig() {
        try {
            await fs.writeJson(this.configPath, this.config, { spaces: 2 });
        }
        catch (error) {
            this.logger.error('Failed to save configuration:', error);
            throw error;
        }
    }
    async authenticate(password) {
        try {
            if (!this.config) {
                throw new Error('Configuration not loaded');
            }
            const isValid = await bcrypt.compare(password, this.config.adminPassword);
            if (isValid) {
                this.logger.info('Admin authentication successful');
            }
            else {
                this.logger.warn('Admin authentication failed');
            }
            return isValid;
        }
        catch (error) {
            this.logger.error('Authentication error:', error);
            return false;
        }
    }
    async getConfiguration() {
        // Return a copy without the password
        if (!this.config) {
            return null;
        }
        const { adminPassword, ...configWithoutPassword } = this.config;
        return configWithoutPassword;
    }
    async updateConfiguration(updates) {
        try {
            if (!this.config) {
                throw new Error('Configuration not loaded');
            }
            // Update configuration
            this.config = { ...this.config, ...updates };
            // If password is being updated, hash it
            if (updates.adminPassword && updates.adminPassword !== this.config.adminPassword) {
                this.config.adminPassword = await bcrypt.hash(updates.adminPassword, 10);
            }
            await this.saveConfig();
            this.logger.info('Configuration updated successfully');
            return true;
        }
        catch (error) {
            this.logger.error('Failed to update configuration:', error);
            return false;
        }
    }
    async testNetworkConnectivity() {
        try {
            const startTime = Date.now();
            // Test basic connectivity
            const response = await fetch('https://httpbin.org/get', {
                method: 'GET'
            });
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            const latency = Date.now() - startTime;
            // Test download speed (simplified)
            const downloadStart = Date.now();
            const downloadResponse = await fetch('https://httpbin.org/bytes/1024', {
                method: 'GET'
            });
            const downloadData = await downloadResponse.arrayBuffer();
            const downloadTime = Date.now() - downloadStart;
            const downloadSpeed = (downloadData.byteLength / 1024) / (downloadTime / 1000); // KB/s
            // Test upload speed (simplified)
            const uploadStart = Date.now();
            const uploadResponse = await fetch('https://httpbin.org/post', {
                method: 'POST',
                body: 'A'.repeat(1024), // 1KB test data
                headers: { 'Content-Type': 'text/plain' }
            });
            const uploadTime = Date.now() - uploadStart;
            const uploadSpeed = 1 / (uploadTime / 1000); // KB/s
            const result = {
                success: true,
                latency,
                downloadSpeed: Math.round(downloadSpeed),
                uploadSpeed: Math.round(uploadSpeed)
            };
            this.logger.info('Network test completed successfully', result);
            return result;
        }
        catch (error) {
            const result = {
                success: false,
                latency: 0,
                downloadSpeed: 0,
                uploadSpeed: 0,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
            this.logger.error('Network test failed:', error);
            return result;
        }
    }
    async changeAdminPassword(currentPassword, newPassword) {
        try {
            if (!this.config) {
                throw new Error('Configuration not loaded');
            }
            // Verify current password
            const isCurrentValid = await bcrypt.compare(currentPassword, this.config.adminPassword);
            if (!isCurrentValid) {
                this.logger.warn('Password change failed: current password incorrect');
                return false;
            }
            // Hash new password
            const hashedNewPassword = await bcrypt.hash(newPassword, 10);
            // Update configuration
            this.config.adminPassword = hashedNewPassword;
            await this.saveConfig();
            this.logger.info('Admin password changed successfully');
            return true;
        }
        catch (error) {
            this.logger.error('Failed to change admin password:', error);
            return false;
        }
    }
    async resetToDefaults() {
        try {
            await this.createDefaultConfig();
            this.logger.info('Configuration reset to defaults');
            return true;
        }
        catch (error) {
            this.logger.error('Failed to reset configuration:', error);
            return false;
        }
    }
    async getArcadeInfo() {
        if (!this.config) {
            return null;
        }
        return {
            arcadeId: this.config.arcadeId,
            locationId: this.config.locationId,
            locationName: this.config.locationName
        };
    }
    async isLockdownEnabled() {
        return this.config?.securitySettings.lockdownEnabled || false;
    }
    async isAutoSyncEnabled() {
        return this.config?.networkSettings.autoSync || false;
    }
    async getSyncInterval() {
        return this.config?.networkSettings.syncInterval || 60;
    }
    async getUpdateCheckInterval() {
        return this.config?.networkSettings.updateCheckInterval || 1440;
    }
    async getDisplaySettings() {
        if (!this.config) {
            return null;
        }
        return this.config.displaySettings;
    }
    async updateDisplaySettings(settings) {
        try {
            if (!this.config) {
                throw new Error('Configuration not loaded');
            }
            this.config.displaySettings = { ...this.config.displaySettings, ...settings };
            await this.saveConfig();
            this.logger.info('Display settings updated');
            return true;
        }
        catch (error) {
            this.logger.error('Failed to update display settings:', error);
            return false;
        }
    }
}
exports.AdminManager = AdminManager;
