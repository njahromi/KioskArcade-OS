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
exports.MultiArcadeManager = void 0;
const fs = __importStar(require("fs-extra"));
const path = __importStar(require("path"));
const Logger_1 = require("../utils/Logger");
const AppConfig_1 = require("../config/AppConfig");
class MultiArcadeManager {
    constructor() {
        this.clusterConfig = null;
        this.gameDistributions = new Map();
        this.unitStatus = new Map();
        this.logger = new Logger_1.Logger();
        this.configManager = AppConfig_1.ConfigManager.getInstance();
        this.clusterConfigPath = path.join(process.cwd(), 'data', 'cluster-config.json');
        this.distributionPath = path.join(process.cwd(), 'data', 'game-distribution.json');
    }
    async initialize() {
        try {
            if (!this.configManager.isMultiArcadeEnabled()) {
                this.logger.info('Multi-arcade disabled, skipping initialization');
                return;
            }
            await fs.ensureDir(path.dirname(this.clusterConfigPath));
            await Promise.all([
                this.loadClusterConfig(),
                this.loadGameDistributions()
            ]);
            // Start cluster monitoring
            this.startClusterMonitoring();
            this.logger.info('MultiArcadeManager initialized successfully');
        }
        catch (error) {
            this.logger.error('Failed to initialize MultiArcadeManager:', error);
            throw error;
        }
    }
    async loadClusterConfig() {
        try {
            if (await fs.pathExists(this.clusterConfigPath)) {
                this.clusterConfig = await fs.readJson(this.clusterConfigPath);
                this.logger.info('Loaded cluster configuration');
            }
            else {
                await this.createDefaultClusterConfig();
            }
        }
        catch (error) {
            this.logger.error('Failed to load cluster config, creating default:', error);
            await this.createDefaultClusterConfig();
        }
    }
    async loadGameDistributions() {
        try {
            if (await fs.pathExists(this.distributionPath)) {
                const data = await fs.readJson(this.distributionPath);
                this.gameDistributions.clear();
                if (Array.isArray(data)) {
                    data.forEach((distribution) => {
                        if (distribution.gameId) {
                            this.gameDistributions.set(distribution.gameId, distribution);
                        }
                    });
                }
                this.logger.info(`Loaded ${this.gameDistributions.size} game distributions`);
            }
        }
        catch (error) {
            this.logger.error('Failed to load game distributions:', error);
        }
    }
    async createDefaultClusterConfig() {
        this.clusterConfig = {
            clusterId: 'CLUSTER_' + Math.random().toString(36).substring(2, 8).toUpperCase(),
            name: 'Default Arcade Cluster',
            units: [
                {
                    id: 'ARCADE_001',
                    name: 'Arcade Unit 1',
                    location: 'Main Floor',
                    status: 'online',
                    lastSeen: new Date(),
                    games: ['tetris', 'snake', 'pong'],
                    performance: {
                        cpuUsage: 0,
                        memoryUsage: 0,
                        diskUsage: 0
                    }
                }
            ],
            loadBalancing: 'least-loaded',
            autoFailover: true,
            syncInterval: 5 // 5 minutes
        };
        await this.saveClusterConfig();
    }
    async saveClusterConfig() {
        try {
            await fs.writeJson(this.clusterConfigPath, this.clusterConfig, { spaces: 2 });
        }
        catch (error) {
            this.logger.error('Failed to save cluster config:', error);
            throw error;
        }
    }
    async saveGameDistributions() {
        try {
            const distributions = Array.from(this.gameDistributions.values());
            await fs.writeJson(this.distributionPath, distributions, { spaces: 2 });
        }
        catch (error) {
            this.logger.error('Failed to save game distributions:', error);
        }
    }
    startClusterMonitoring() {
        setInterval(async () => {
            await this.updateUnitStatuses();
            await this.performLoadBalancing();
        }, this.clusterConfig?.syncInterval * 60 * 1000 || 300000); // Default 5 minutes
    }
    async updateUnitStatuses() {
        if (!this.clusterConfig)
            return;
        for (const unit of this.clusterConfig.units) {
            const status = await this.checkUnitHealth(unit.id);
            this.unitStatus.set(unit.id, {
                ...unit,
                status,
                lastSeen: new Date()
            });
        }
        this.logger.info(`Updated status for ${this.clusterConfig.units.length} units`);
    }
    async checkUnitHealth(unitId) {
        // In a real implementation, this would ping the unit
        // For now, we'll simulate health checks
        const random = Math.random();
        if (random > 0.9)
            return 'error';
        if (random > 0.8)
            return 'maintenance';
        if (random > 0.7)
            return 'offline';
        return 'online';
    }
    async performLoadBalancing() {
        if (!this.clusterConfig)
            return;
        const onlineUnits = Array.from(this.unitStatus.values())
            .filter(unit => unit.status === 'online');
        if (onlineUnits.length === 0) {
            this.logger.warn('No online units available for load balancing');
            return;
        }
        // Update performance metrics for load balancing
        for (const unit of onlineUnits) {
            const performance = await this.getUnitPerformance(unit.id);
            this.unitStatus.set(unit.id, {
                ...unit,
                performance
            });
        }
        this.logger.info(`Load balancing completed for ${onlineUnits.length} units`);
    }
    async getUnitPerformance(unitId) {
        // In a real implementation, this would query the unit's performance
        // For now, we'll simulate performance data
        return {
            cpuUsage: Math.random() * 100,
            memoryUsage: Math.random() * 100,
            diskUsage: Math.random() * 100
        };
    }
    async selectUnitForGame(gameId) {
        if (!this.clusterConfig) {
            return null;
        }
        const onlineUnits = Array.from(this.unitStatus.values())
            .filter(unit => unit.status === 'online');
        if (onlineUnits.length === 0) {
            return null;
        }
        let selectedUnit;
        let reason;
        switch (this.clusterConfig.loadBalancing) {
            case 'round-robin':
                const index = Math.floor(Math.random() * onlineUnits.length);
                selectedUnit = onlineUnits[index];
                reason = 'Round-robin selection';
                break;
            case 'least-loaded':
                selectedUnit = onlineUnits.reduce((min, unit) => unit.performance.cpuUsage < min.performance.cpuUsage ? unit : min);
                reason = 'Least loaded unit';
                break;
            case 'geographic':
                // In a real implementation, this would consider geographic proximity
                selectedUnit = onlineUnits[0];
                reason = 'Geographic selection';
                break;
            default:
                selectedUnit = onlineUnits[0];
                reason = 'Default selection';
        }
        return {
            targetUnit: selectedUnit.id,
            reason,
            estimatedLoad: selectedUnit.performance.cpuUsage
        };
    }
    async distributeGame(gameId, units) {
        try {
            const distribution = {
                gameId,
                units,
                version: '1.0.0',
                lastUpdated: new Date(),
                status: 'syncing'
            };
            this.gameDistributions.set(gameId, distribution);
            await this.saveGameDistributions();
            // Simulate distribution process
            setTimeout(() => {
                distribution.status = 'synced';
                this.saveGameDistributions();
            }, 5000);
            this.logger.info(`Game ${gameId} distributed to ${units.length} units`);
            return true;
        }
        catch (error) {
            this.logger.error(`Failed to distribute game ${gameId}:`, error);
            return false;
        }
    }
    async getClusterStatus() {
        if (!this.clusterConfig) {
            return {
                totalUnits: 0,
                onlineUnits: 0,
                offlineUnits: 0,
                maintenanceUnits: 0,
                errorUnits: 0,
                averageLoad: 0
            };
        }
        const units = Array.from(this.unitStatus.values());
        const statusCounts = units.reduce((counts, unit) => {
            counts[unit.status]++;
            return counts;
        }, { online: 0, offline: 0, maintenance: 0, error: 0 });
        const averageLoad = units.length > 0
            ? units.reduce((sum, unit) => sum + unit.performance.cpuUsage, 0) / units.length
            : 0;
        return {
            totalUnits: units.length,
            onlineUnits: statusCounts.online,
            offlineUnits: statusCounts.offline,
            maintenanceUnits: statusCounts.maintenance,
            errorUnits: statusCounts.error,
            averageLoad
        };
    }
    async addUnit(unit) {
        try {
            if (!this.clusterConfig) {
                throw new Error('Cluster config not loaded');
            }
            const newUnit = {
                ...unit,
                lastSeen: new Date(),
                performance: {
                    cpuUsage: 0,
                    memoryUsage: 0,
                    diskUsage: 0
                }
            };
            this.clusterConfig.units.push(newUnit);
            this.unitStatus.set(newUnit.id, newUnit);
            await this.saveClusterConfig();
            this.logger.info(`Added unit: ${unit.name} (${unit.id})`);
            return true;
        }
        catch (error) {
            this.logger.error(`Failed to add unit ${unit.id}:`, error);
            return false;
        }
    }
    async removeUnit(unitId) {
        try {
            if (!this.clusterConfig) {
                throw new Error('Cluster config not loaded');
            }
            this.clusterConfig.units = this.clusterConfig.units.filter(unit => unit.id !== unitId);
            this.unitStatus.delete(unitId);
            await this.saveClusterConfig();
            this.logger.info(`Removed unit: ${unitId}`);
            return true;
        }
        catch (error) {
            this.logger.error(`Failed to remove unit ${unitId}:`, error);
            return false;
        }
    }
    async updateClusterConfig(updates) {
        try {
            if (!this.clusterConfig) {
                throw new Error('Cluster config not loaded');
            }
            this.clusterConfig = { ...this.clusterConfig, ...updates };
            await this.saveClusterConfig();
            this.logger.info('Cluster configuration updated');
            return true;
        }
        catch (error) {
            this.logger.error('Failed to update cluster config:', error);
            return false;
        }
    }
    async getGameDistribution(gameId) {
        return this.gameDistributions.get(gameId) || null;
    }
    async getAllGameDistributions() {
        return Array.from(this.gameDistributions.values());
    }
    async getUnitStatus(unitId) {
        return this.unitStatus.get(unitId) || null;
    }
    async getAllUnitStatuses() {
        return Array.from(this.unitStatus.values());
    }
}
exports.MultiArcadeManager = MultiArcadeManager;
