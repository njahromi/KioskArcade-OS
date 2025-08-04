#!/usr/bin/env ts-node

import { TokenManager } from '../electron-app/services/TokenManager';
import { Logger } from '../electron-app/utils/Logger';

class TokenRotationService {
  private tokenManager: TokenManager;
  private logger: Logger;

  constructor() {
    this.tokenManager = new TokenManager();
    this.logger = new Logger();
  }

  async initialize(): Promise<void> {
    try {
      await this.tokenManager.initialize();
      this.logger.info('Token rotation service initialized');
    } catch (error) {
      this.logger.error('Failed to initialize token rotation service:', error);
      throw error;
    }
  }

  async rotateToken(): Promise<boolean> {
    try {
      this.logger.info('Starting token rotation...');
      
      // Check if current token is valid
      const isTokenValid = await this.tokenManager.isTokenValid();
      if (!isTokenValid) {
        this.logger.warn('Current token is invalid, generating new token');
      }

      // Rotate the token
      const success = await this.tokenManager.rotateToken();
      
      if (success) {
        this.logger.info('Token rotation completed successfully');
        
        // Get new token info
        const tokenData = await this.tokenManager.getTokenData();
        if (tokenData) {
          this.logger.info('New token generated', {
            arcadeId: tokenData.arcadeId,
            locationId: tokenData.locationId,
            expiresAt: tokenData.expiresAt
          });
        }
      } else {
        this.logger.error('Token rotation failed');
      }
      
      return success;
    } catch (error) {
      this.logger.error('Token rotation error:', error);
      return false;
    }
  }

  async checkTokenStatus(): Promise<void> {
    try {
      const tokenData = await this.tokenManager.getTokenData();
      const isValid = await this.tokenManager.isTokenValid();
      const arcadeId = await this.tokenManager.getArcadeId();
      const locationId = await this.tokenManager.getLocationId();
      const expiry = await this.tokenManager.getTokenExpiry();

      this.logger.info('Token status check', {
        arcadeId,
        locationId,
        isValid,
        expiresAt: expiry?.toISOString(),
        daysUntilExpiry: expiry ? Math.ceil((expiry.getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : null
      });

      // Warn if token expires soon
      if (expiry && (expiry.getTime() - Date.now()) < 7 * 24 * 60 * 60 * 1000) { // 7 days
        this.logger.warn('Token expires soon', {
          expiresAt: expiry.toISOString(),
          daysUntilExpiry: Math.ceil((expiry.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
        });
      }
    } catch (error) {
      this.logger.error('Token status check failed:', error);
    }
  }

  async validateTokenIntegrity(): Promise<boolean> {
    try {
      const token = await this.tokenManager.getCurrentToken();
      const tokenData = await this.tokenManager.getTokenData();
      
      if (!token || !tokenData) {
        this.logger.error('Token integrity check failed: missing token data');
        return false;
      }

      // Basic validation
      if (token.length !== 64) { // 32 bytes = 64 hex chars
        this.logger.error('Token integrity check failed: invalid token length');
        return false;
      }

      if (!tokenData.arcadeId || !tokenData.locationId) {
        this.logger.error('Token integrity check failed: missing arcade/location IDs');
        return false;
      }

      this.logger.info('Token integrity check passed');
      return true;
    } catch (error) {
      this.logger.error('Token integrity check failed:', error);
      return false;
    }
  }

  async forceTokenRotation(): Promise<boolean> {
    try {
      this.logger.warn('Force token rotation requested');
      
      // Force rotation by clearing current token
      const success = await this.tokenManager.rotateToken();
      
      if (success) {
        this.logger.info('Force token rotation completed');
      } else {
        this.logger.error('Force token rotation failed');
      }
      
      return success;
    } catch (error) {
      this.logger.error('Force token rotation error:', error);
      return false;
    }
  }
}

// CLI interface
async function main() {
  const service = new TokenRotationService();
  
  try {
    await service.initialize();
    
    const args = process.argv.slice(2);
    const command = args[0] || 'status';
    
    switch (command) {
      case 'rotate':
        const success = await service.rotateToken();
        process.exit(success ? 0 : 1);
        break;
        
      case 'status':
        await service.checkTokenStatus();
        break;
        
      case 'validate':
        const isValid = await service.validateTokenIntegrity();
        process.exit(isValid ? 0 : 1);
        break;
        
      case 'force':
        const forceSuccess = await service.forceTokenRotation();
        process.exit(forceSuccess ? 0 : 1);
        break;
        
      default:
        console.log('Usage: token-rotate [command]');
        console.log('Commands:');
        console.log('  rotate   - Rotate the current token');
        console.log('  status   - Check token status');
        console.log('  validate - Validate token integrity');
        console.log('  force    - Force token rotation');
        process.exit(1);
    }
  } catch (error) {
    console.error('Token rotation service error:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { TokenRotationService }; 