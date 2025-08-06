import * as fs from 'fs-extra';
import * as path from 'path';
import { Logger } from '../utils/Logger';
import { ConfigManager } from '../config/AppConfig';

interface ArcadeUnit {
  readonly id: string;
  readonly name: string;
  readonly location: string;
  readonly status: 'online' | 'offline' | 'maintenance' | 'error';
  readonly lastSeen: Date;
  readonly games: string[];
  readonly performance: {
    readonly cpuUsage: number;
    readonly memoryUsage: number;
    readonly diskUsage: number;
  };
}

interface ClusterConfig {
  readonly clusterId: string;
  readonly name: string;
  units: ArcadeUnit[]; // Mutable for unit management
  readonly loadBalancing: 'round-robin' | 'least-loaded' | 'geographic';
  readonly autoFailover: boolean;
  readonly syncInterval: number; // minutes
}

interface GameDistribution {
  readonly gameId: string;
  readonly units: string[];
  readonly version: string;
  readonly lastUpdated: Date;
  status: 'syncing' | 'synced' | 'error'; // Mutable for status updates
}

interface LoadBalancingResult {
  readonly targetUnit: string;
  readonly reason: string;
  readonly estimatedLoad: number;
}

export class MultiArcadeManager {
  private readonly logger: Logger;
  private readonly configManager: ConfigManager;
  private readonly clusterConfigPath: string;
  private readonly distributionPath: string;
  private clusterConfig: ClusterConfig | null = null;
  private readonly gameDistributions: Map<string, GameDistribution> = new Map();
  private readonly unitStatus: Map<string, ArcadeUnit> = new Map();

  constructor() {
    this.logger = new Logger();
    this.configManager = ConfigManager.getInstance();
    this.clusterConfigPath = path.join(process.cwd(), 'data', 'cluster-config.json');
    this.distributionPath = path.join(process.cwd(), 'data', 'game-distribution.json');
  }

  async initialize(): Promise<void> {
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
    } catch (error) {
      this.logger.error('Failed to initialize MultiArcadeManager:', error);
      throw error;
    }
  }

  private async loadClusterConfig(): Promise<void> {
    try {
      if (await fs.pathExists(this.clusterConfigPath)) {
        this.clusterConfig = await fs.readJson(this.clusterConfigPath);
        this.logger.info('Loaded cluster configuration');
      } else {
        await this.createDefaultClusterConfig();
      }
    } catch (error) {
      this.logger.error('Failed to load cluster config, creating default:', error);
      await this.createDefaultClusterConfig();
    }
  }

  private async loadGameDistributions(): Promise<void> {
    try {
      if (await fs.pathExists(this.distributionPath)) {
        const data = await fs.readJson(this.distributionPath);
        this.gameDistributions.clear();
        if (Array.isArray(data)) {
          data.forEach((distribution: GameDistribution) => {
            if (distribution.gameId) {
              this.gameDistributions.set(distribution.gameId, distribution);
            }
          });
        }
        this.logger.info(`Loaded ${this.gameDistributions.size} game distributions`);
      }
    } catch (error) {
      this.logger.error('Failed to load game distributions:', error);
    }
  }

  private async createDefaultClusterConfig(): Promise<void> {
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

  private async saveClusterConfig(): Promise<void> {
    try {
      await fs.writeJson(this.clusterConfigPath, this.clusterConfig, { spaces: 2 });
    } catch (error) {
      this.logger.error('Failed to save cluster config:', error);
      throw error;
    }
  }

  private async saveGameDistributions(): Promise<void> {
    try {
      const distributions = Array.from(this.gameDistributions.values());
      await fs.writeJson(this.distributionPath, distributions, { spaces: 2 });
    } catch (error) {
      this.logger.error('Failed to save game distributions:', error);
    }
  }

  private startClusterMonitoring(): void {
    setInterval(async () => {
      await this.updateUnitStatuses();
      await this.performLoadBalancing();
    }, (this.clusterConfig?.syncInterval || 5) * 60 * 1000); // Default 5 minutes
  }

  private async updateUnitStatuses(): Promise<void> {
    if (!this.clusterConfig) return;

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

  private async checkUnitHealth(unitId: string): Promise<'online' | 'offline' | 'maintenance' | 'error'> {
    // In a real implementation, this would ping the unit
    // For now, we'll simulate health checks
    const random = Math.random();
    if (random > 0.9) return 'error';
    if (random > 0.8) return 'maintenance';
    if (random > 0.7) return 'offline';
    return 'online';
  }

  private async performLoadBalancing(): Promise<void> {
    if (!this.clusterConfig) return;

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

  private async getUnitPerformance(unitId: string): Promise<{ cpuUsage: number; memoryUsage: number; diskUsage: number }> {
    // In a real implementation, this would query the unit's performance
    // For now, we'll simulate performance data
    return {
      cpuUsage: Math.random() * 100,
      memoryUsage: Math.random() * 100,
      diskUsage: Math.random() * 100
    };
  }

  async selectUnitForGame(gameId: string): Promise<LoadBalancingResult | null> {
    if (!this.clusterConfig) {
      return null;
    }

    const onlineUnits = Array.from(this.unitStatus.values())
      .filter(unit => unit.status === 'online');

    if (onlineUnits.length === 0) {
      return null;
    }

    let selectedUnit: ArcadeUnit;
    let reason: string;

    switch (this.clusterConfig.loadBalancing) {
      case 'round-robin':
        const index = Math.floor(Math.random() * onlineUnits.length);
        selectedUnit = onlineUnits[index];
        reason = 'Round-robin selection';
        break;

      case 'least-loaded':
        selectedUnit = onlineUnits.reduce((min, unit) => 
          unit.performance.cpuUsage < min.performance.cpuUsage ? unit : min
        );
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

  async distributeGame(gameId: string, units: string[]): Promise<boolean> {
    try {
      const distribution: GameDistribution = {
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
    } catch (error) {
      this.logger.error(`Failed to distribute game ${gameId}:`, error);
      return false;
    }
  }

  async getClusterStatus(): Promise<{
    totalUnits: number;
    onlineUnits: number;
    offlineUnits: number;
    maintenanceUnits: number;
    errorUnits: number;
    averageLoad: number;
  }> {
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

  async addUnit(unit: Omit<ArcadeUnit, 'lastSeen' | 'performance'>): Promise<boolean> {
    try {
      if (!this.clusterConfig) {
        throw new Error('Cluster config not loaded');
      }

      const newUnit: ArcadeUnit = {
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
    } catch (error) {
      this.logger.error(`Failed to add unit ${unit.id}:`, error);
      return false;
    }
  }

  async removeUnit(unitId: string): Promise<boolean> {
    try {
      if (!this.clusterConfig) {
        throw new Error('Cluster config not loaded');
      }

      this.clusterConfig.units = this.clusterConfig.units.filter(unit => unit.id !== unitId);
      this.unitStatus.delete(unitId);
      await this.saveClusterConfig();

      this.logger.info(`Removed unit: ${unitId}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to remove unit ${unitId}:`, error);
      return false;
    }
  }

  async updateClusterConfig(updates: Partial<ClusterConfig>): Promise<boolean> {
    try {
      if (!this.clusterConfig) {
        throw new Error('Cluster config not loaded');
      }

      this.clusterConfig = { ...this.clusterConfig, ...updates };
      await this.saveClusterConfig();

      this.logger.info('Cluster configuration updated');
      return true;
    } catch (error) {
      this.logger.error('Failed to update cluster config:', error);
      return false;
    }
  }

  async getGameDistribution(gameId: string): Promise<GameDistribution | null> {
    return this.gameDistributions.get(gameId) || null;
  }

  async getAllGameDistributions(): Promise<GameDistribution[]> {
    return Array.from(this.gameDistributions.values());
  }

  async getUnitStatus(unitId: string): Promise<ArcadeUnit | null> {
    return this.unitStatus.get(unitId) || null;
  }

  async getAllUnitStatuses(): Promise<ArcadeUnit[]> {
    return Array.from(this.unitStatus.values());
  }
} 