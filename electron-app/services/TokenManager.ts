import * as crypto from 'crypto';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';
import { Logger } from '../utils/Logger';

interface TokenData {
  readonly token: string;
  readonly createdAt: Date;
  readonly expiresAt: Date;
  readonly arcadeId: string;
  readonly locationId: string;
}

export class TokenManager {
  private readonly tokenFilePath: string;
  private readonly logger: Logger;
  private currentToken: TokenData | null = null;
  private readonly arcadeId: string;
  private readonly locationId: string;

  constructor() {
    this.logger = new Logger();
    this.tokenFilePath = path.join(process.cwd(), 'data', 'token.json');
    this.arcadeId = this.generateArcadeId();
    this.locationId = this.generateLocationId();
  }

  async initialize(): Promise<void> {
    try {
      // Ensure data directory exists
      await fs.ensureDir(path.dirname(this.tokenFilePath));
      
      // Load existing token or generate new one
      await this.loadOrGenerateToken();
      
      this.logger.info('TokenManager initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize TokenManager:', error);
      throw error;
    }
  }

  private generateArcadeId(): string {
    // Generate a unique arcade ID based on hardware characteristics
    const networkInterfaces = os.networkInterfaces();
    const interfaces = Object.values(networkInterfaces).flat() as any[];
    const macAddress = interfaces.find((iface: any) => !iface.internal && iface.mac !== '00:00:00:00:00:00')?.mac || 'unknown';
    
    const hash = crypto.createHash('sha256');
    hash.update(macAddress + os.hostname() + os.platform());
    return hash.digest('hex').substring(0, 16);
  }

  private generateLocationId(): string {
    // Generate a location ID (in real deployment, this would come from configuration)
    return 'LOC_' + Math.random().toString(36).substring(2, 8).toUpperCase();
  }

  private async loadOrGenerateToken(): Promise<void> {
    try {
      if (await fs.pathExists(this.tokenFilePath)) {
        const tokenData = await fs.readJson(this.tokenFilePath);
        const expiresAt = new Date(tokenData.expiresAt);
        
        if (expiresAt > new Date()) {
          this.currentToken = tokenData;
          this.logger.info('Loaded existing valid token');
          return;
        } else {
          this.logger.info('Existing token expired, generating new one');
        }
      }
      
      await this.generateNewToken();
    } catch (error) {
      this.logger.error('Failed to load token, generating new one:', error);
      await this.generateNewToken();
    }
  }

  private async generateNewToken(): Promise<void> {
    const token = crypto.randomBytes(32).toString('hex');
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days

    this.currentToken = {
      token,
      createdAt: now,
      expiresAt,
      arcadeId: this.arcadeId,
      locationId: this.locationId
    };

    await this.saveToken();
    await this.publishTokenToPubSub();
    
    this.logger.info('Generated new token');
  }

  private async saveToken(): Promise<void> {
    try {
      await fs.writeJson(this.tokenFilePath, this.currentToken, { spaces: 2 });
    } catch (error) {
      this.logger.error('Failed to save token:', error);
      throw error;
    }
  }

  private async publishTokenToPubSub(): Promise<void> {
    try {
      // In a real implementation, this would publish to GCP Pub/Sub
      // For now, we'll simulate this with a local file
      const pubsubData = {
        arcadeId: this.currentToken?.arcadeId,
        locationId: this.currentToken?.locationId,
        token: this.currentToken?.token,
        timestamp: new Date().toISOString()
      };

      const pubsubPath = path.join(process.cwd(), 'data', 'pubsub.json');
      await fs.ensureDir(path.dirname(pubsubPath));
      await fs.writeJson(pubsubPath, pubsubData, { spaces: 2 });
      
      this.logger.info('Token published to Pub/Sub (simulated)');
    } catch (error) {
      this.logger.error('Failed to publish token to Pub/Sub:', error);
      // Don't throw here as token generation should still succeed
    }
  }

  async getCurrentToken(): Promise<string> {
    if (!this.currentToken) {
      throw new Error('No token available');
    }
    return this.currentToken.token;
  }

  async getTokenData(): Promise<TokenData | null> {
    return this.currentToken;
  }

  async rotateToken(): Promise<boolean> {
    try {
      await this.generateNewToken();
      this.logger.info('Token rotated successfully');
      return true;
    } catch (error) {
      this.logger.error('Failed to rotate token:', error);
      return false;
    }
  }

  async isTokenValid(): Promise<boolean> {
    if (!this.currentToken) {
      return false;
    }
    
    const now = new Date();
    return now < this.currentToken.expiresAt;
  }

  async getArcadeId(): Promise<string> {
    return this.arcadeId;
  }

  async getLocationId(): Promise<string> {
    return this.locationId;
  }

  async getTokenExpiry(): Promise<Date | null> {
    return this.currentToken?.expiresAt || null;
  }
} 