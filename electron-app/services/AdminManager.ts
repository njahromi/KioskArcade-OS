import * as fs from 'fs-extra';
import * as path from 'path';
import * as bcrypt from 'bcryptjs';
import fetch from 'node-fetch';
import { Logger } from '../utils/Logger';

interface ArcadeConfig {
  arcadeId: string;
  locationId: string;
  locationName: string;
  adminPassword: string;
  networkSettings: {
    autoSync: boolean;
    syncInterval: number; // minutes
    updateCheckInterval: number; // minutes
  };
  displaySettings: {
    brightness: number;
    volume: number;
    autoStart: boolean;
  };
  securitySettings: {
    lockdownEnabled: boolean;
    allowAdminAccess: boolean;
    sessionTimeout: number; // minutes
  };
}

interface NetworkTestResult {
  success: boolean;
  latency: number;
  downloadSpeed: number;
  uploadSpeed: number;
  error?: string;
}

export class AdminManager {
  private readonly configPath: string;
  private readonly logger: Logger;
  private config: ArcadeConfig | null = null;
  private readonly defaultPassword = 'admin123'; // In production, this would be set during setup

  constructor() {
    this.logger = new Logger();
    this.configPath = path.join(process.cwd(), 'data', 'config.json');
  }

  async initialize(): Promise<void> {
    try {
      await fs.ensureDir(path.dirname(this.configPath));
      await this.loadOrCreateConfig();
      this.logger.info('AdminManager initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize AdminManager:', error);
      throw error;
    }
  }

  private async loadOrCreateConfig(): Promise<void> {
    try {
      if (await fs.pathExists(this.configPath)) {
        this.config = await fs.readJson(this.configPath);
        this.logger.info('Loaded existing configuration');
      } else {
        await this.createDefaultConfig();
        this.logger.info('Created default configuration');
      }
    } catch (error) {
      this.logger.error('Failed to load config, creating default:', error);
      await this.createDefaultConfig();
    }
  }

  private async createDefaultConfig(): Promise<void> {
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

  private async saveConfig(): Promise<void> {
    try {
      await fs.writeJson(this.configPath, this.config, { spaces: 2 });
    } catch (error) {
      this.logger.error('Failed to save configuration:', error);
      throw error;
    }
  }

  async authenticate(password: string): Promise<boolean> {
    try {
      if (!this.config) {
        throw new Error('Configuration not loaded');
      }

      const isValid = await bcrypt.compare(password, this.config.adminPassword);
      
      if (isValid) {
        this.logger.info('Admin authentication successful');
      } else {
        this.logger.warn('Admin authentication failed');
      }

      return isValid;
    } catch (error) {
      this.logger.error('Authentication error:', error);
      return false;
    }
  }

  async getConfiguration(): Promise<ArcadeConfig | null> {
    // Return a copy without the password
    if (!this.config) {
      return null;
    }

    const { adminPassword, ...configWithoutPassword } = this.config;
    return configWithoutPassword as ArcadeConfig;
  }

  async updateConfiguration(updates: Partial<ArcadeConfig>): Promise<boolean> {
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
    } catch (error) {
      this.logger.error('Failed to update configuration:', error);
      return false;
    }
  }

  async testNetworkConnectivity(): Promise<NetworkTestResult> {
    try {
      const startTime = Date.now();
      
      // Test basic connectivity
      const response = await fetch('https://httpbin.org/get', {
        method: 'GET',
        timeout: 10000
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const latency = Date.now() - startTime;

      // Test download speed (simplified)
      const downloadStart = Date.now();
      const downloadResponse = await fetch('https://httpbin.org/bytes/1024', {
        method: 'GET',
        timeout: 10000
      });
      const downloadData = await downloadResponse.arrayBuffer();
      const downloadTime = Date.now() - downloadStart;
      const downloadSpeed = (downloadData.byteLength / 1024) / (downloadTime / 1000); // KB/s

      // Test upload speed (simplified)
      const uploadStart = Date.now();
      const uploadResponse = await fetch('https://httpbin.org/post', {
        method: 'POST',
        body: 'A'.repeat(1024), // 1KB test data
        headers: { 'Content-Type': 'text/plain' },
        timeout: 10000
      });
      const uploadTime = Date.now() - uploadStart;
      const uploadSpeed = 1 / (uploadTime / 1000); // KB/s

      const result: NetworkTestResult = {
        success: true,
        latency,
        downloadSpeed: Math.round(downloadSpeed),
        uploadSpeed: Math.round(uploadSpeed)
      };

      this.logger.info('Network test completed successfully', result);
      return result;
    } catch (error) {
      const result: NetworkTestResult = {
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

  async changeAdminPassword(currentPassword: string, newPassword: string): Promise<boolean> {
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
    } catch (error) {
      this.logger.error('Failed to change admin password:', error);
      return false;
    }
  }

  async resetToDefaults(): Promise<boolean> {
    try {
      await this.createDefaultConfig();
      this.logger.info('Configuration reset to defaults');
      return true;
    } catch (error) {
      this.logger.error('Failed to reset configuration:', error);
      return false;
    }
  }

  async getArcadeInfo(): Promise<{ arcadeId: string; locationId: string; locationName: string } | null> {
    if (!this.config) {
      return null;
    }

    return {
      arcadeId: this.config.arcadeId,
      locationId: this.config.locationId,
      locationName: this.config.locationName
    };
  }

  async isLockdownEnabled(): Promise<boolean> {
    return this.config?.securitySettings.lockdownEnabled || false;
  }

  async isAutoSyncEnabled(): Promise<boolean> {
    return this.config?.networkSettings.autoSync || false;
  }

  async getSyncInterval(): Promise<number> {
    return this.config?.networkSettings.syncInterval || 60;
  }

  async getUpdateCheckInterval(): Promise<number> {
    return this.config?.networkSettings.updateCheckInterval || 1440;
  }

  async getDisplaySettings(): Promise<{ brightness: number; volume: number; autoStart: boolean } | null> {
    if (!this.config) {
      return null;
    }

    return this.config.displaySettings;
  }

  async updateDisplaySettings(settings: Partial<{ brightness: number; volume: number; autoStart: boolean }>): Promise<boolean> {
    try {
      if (!this.config) {
        throw new Error('Configuration not loaded');
      }

      this.config.displaySettings = { ...this.config.displaySettings, ...settings };
      await this.saveConfig();

      this.logger.info('Display settings updated');
      return true;
    } catch (error) {
      this.logger.error('Failed to update display settings:', error);
      return false;
    }
  }
} 