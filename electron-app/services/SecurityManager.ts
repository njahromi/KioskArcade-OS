import * as fs from 'fs-extra';
import * as path from 'path';
import { Logger } from '../utils/Logger';

interface SecurityStatus {
  lockdownEnabled: boolean; // Mutable for status updates
  shortcutsBlocked: boolean; // Mutable for status updates
  adminAccessEnabled: boolean; // Mutable for status updates
  sessionActive: boolean; // Mutable for session management
  lastSecurityCheck: Date; // Mutable for timestamp updates
  securityLevel: 'low' | 'medium' | 'high' | 'critical'; // Mutable for level changes
}

interface SecurityEvent {
  readonly timestamp: Date;
  readonly event: string;
  readonly details: string;
  readonly severity: 'info' | 'warning' | 'error' | 'critical';
}

export class SecurityManager {
  private readonly logger: Logger;
  private readonly securityLogPath: string;
  private readonly events: SecurityEvent[] = [];
  private securityStatus: SecurityStatus;
  private sessionStartTime: Date | null = null;

  constructor() {
    this.logger = new Logger();
    this.securityLogPath = path.join(process.cwd(), 'data', 'security.log');
    
    this.securityStatus = {
      lockdownEnabled: false,
      shortcutsBlocked: false,
      adminAccessEnabled: true,
      sessionActive: false,
      lastSecurityCheck: new Date(),
      securityLevel: 'medium'
    };
  }

  async initialize(): Promise<void> {
    try {
      await fs.ensureDir(path.dirname(this.securityLogPath));
      await this.loadSecurityLog();
      await this.performSecurityCheck();
      
      this.logger.info('SecurityManager initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize SecurityManager:', error);
      throw error;
    }
  }

  private async loadSecurityLog(): Promise<void> {
    try {
      if (await fs.pathExists(this.securityLogPath)) {
        const logData = await fs.readFile(this.securityLogPath, 'utf8');
        const lines = logData.split('\n').filter(line => line.trim());
        
        this.events.length = 0;
        lines.forEach(line => {
          try {
            const event = JSON.parse(line);
            if (event && event.timestamp && event.event) {
              this.events.push(event);
            }
          } catch {
            // Skip invalid JSON lines
          }
        });
        
        this.logger.info(`Loaded ${this.events.length} security events`);
      }
    } catch (error) {
      this.logger.error('Failed to load security log:', error);
    }
  }

  private async logSecurityEvent(event: SecurityEvent): Promise<void> {
    try {
      this.events.push(event);
      
      // Keep only last 1000 events
      if (this.events.length > 1000) {
        this.events.splice(0, this.events.length - 1000);
      }
      
      // Write to log file
      const logLine = JSON.stringify(event) + '\n';
      await fs.appendFile(this.securityLogPath, logLine);
      
      this.logger.info(`Security event: ${event.event}`, event);
    } catch (error) {
      this.logger.error('Failed to log security event:', error);
    }
  }

  async enableLockdown(): Promise<boolean> {
    try {
      this.securityStatus.lockdownEnabled = true;
      this.securityStatus.securityLevel = 'high';
      this.securityStatus.shortcutsBlocked = true;
      
      await this.logSecurityEvent({
        timestamp: new Date(),
        event: 'lockdown_enabled',
        details: 'Application lockdown mode activated',
        severity: 'warning'
      });
      
      this.logger.info('Lockdown mode enabled');
      return true;
    } catch (error) {
      this.logger.error('Failed to enable lockdown:', error);
      return false;
    }
  }

  async disableLockdown(): Promise<boolean> {
    try {
      this.securityStatus.lockdownEnabled = false;
      this.securityStatus.securityLevel = 'medium';
      this.securityStatus.shortcutsBlocked = false;
      
      await this.logSecurityEvent({
        timestamp: new Date(),
        event: 'lockdown_disabled',
        details: 'Application lockdown mode deactivated',
        severity: 'info'
      });
      
      this.logger.info('Lockdown mode disabled');
      return true;
    } catch (error) {
      this.logger.error('Failed to disable lockdown:', error);
      return false;
    }
  }

  async startAdminSession(): Promise<boolean> {
    try {
      this.sessionStartTime = new Date();
      this.securityStatus.sessionActive = true;
      this.securityStatus.adminAccessEnabled = true;
      
      await this.logSecurityEvent({
        timestamp: new Date(),
        event: 'admin_session_started',
        details: 'Administrator session initiated',
        severity: 'info'
      });
      
      this.logger.info('Admin session started');
      return true;
    } catch (error) {
      this.logger.error('Failed to start admin session:', error);
      return false;
    }
  }

  async endAdminSession(): Promise<boolean> {
    try {
      this.sessionStartTime = null;
      this.securityStatus.sessionActive = false;
      
      await this.logSecurityEvent({
        timestamp: new Date(),
        event: 'admin_session_ended',
        details: 'Administrator session terminated',
        severity: 'info'
      });
      
      this.logger.info('Admin session ended');
      return true;
    } catch (error) {
      this.logger.error('Failed to end admin session:', error);
      return false;
    }
  }

  async getStatus(): Promise<SecurityStatus> {
    // Update last security check
    this.securityStatus.lastSecurityCheck = new Date();
    
    // Check session timeout
    if (this.sessionStartTime) {
      const sessionDuration = Date.now() - this.sessionStartTime.getTime();
      const timeoutMinutes = 30; // 30 minute timeout
      
      if (sessionDuration > timeoutMinutes * 60 * 1000) {
        await this.endAdminSession();
        await this.logSecurityEvent({
          timestamp: new Date(),
          event: 'session_timeout',
          details: `Admin session timed out after ${timeoutMinutes} minutes`,
          severity: 'warning'
        });
      }
    }
    
    return { ...this.securityStatus };
  }

  async performSecurityCheck(): Promise<void> {
    try {
      // Check for suspicious activities
      const recentEvents = this.events.filter(event => 
        event.timestamp.getTime() > Date.now() - 24 * 60 * 60 * 1000 // Last 24 hours
      );
      
      const errorEvents = recentEvents.filter(event => 
        event.severity === 'error' || event.severity === 'critical'
      );
      
      const warningEvents = recentEvents.filter(event => 
        event.severity === 'warning'
      );
      
      // Update security level based on events
      if (errorEvents.length > 5) {
        this.securityStatus.securityLevel = 'critical';
      } else if (errorEvents.length > 2 || warningEvents.length > 10) {
        this.securityStatus.securityLevel = 'high';
      } else if (warningEvents.length > 5) {
        this.securityStatus.securityLevel = 'medium';
      } else {
        this.securityStatus.securityLevel = 'low';
      }
      
      await this.logSecurityEvent({
        timestamp: new Date(),
        event: 'security_check',
        details: `Security check completed. Level: ${this.securityStatus.securityLevel}`,
        severity: 'info'
      });
      
      this.logger.info(`Security check completed. Level: ${this.securityStatus.securityLevel}`);
    } catch (error) {
      this.logger.error('Failed to perform security check:', error);
    }
  }

  async logSecurityViolation(violation: string, details: string): Promise<void> {
    await this.logSecurityEvent({
      timestamp: new Date(),
      event: 'security_violation',
      details: `${violation}: ${details}`,
      severity: 'error'
    });
    
    // If multiple violations occur, increase security level
    const recentViolations = this.events.filter(event => 
      event.event === 'security_violation' && 
      event.timestamp.getTime() > Date.now() - 60 * 60 * 1000 // Last hour
    );
    
    if (recentViolations.length > 3) {
      this.securityStatus.securityLevel = 'critical';
      await this.enableLockdown();
    }
  }

  async getSecurityEvents(limit: number = 50): Promise<SecurityEvent[]> {
    return this.events.slice(-limit).reverse();
  }

  async clearSecurityLog(): Promise<boolean> {
    try {
      this.events.length = 0;
      await fs.writeFile(this.securityLogPath, '');
      
      await this.logSecurityEvent({
        timestamp: new Date(),
        event: 'security_log_cleared',
        details: 'Security log cleared by administrator',
        severity: 'info'
      });
      
      this.logger.info('Security log cleared');
      return true;
    } catch (error) {
      this.logger.error('Failed to clear security log:', error);
      return false;
    }
  }

  async isLockdownEnabled(): Promise<boolean> {
    return this.securityStatus.lockdownEnabled;
  }

  async isAdminSessionActive(): Promise<boolean> {
    return this.securityStatus.sessionActive;
  }

  async getSecurityLevel(): Promise<'low' | 'medium' | 'high' | 'critical'> {
    return this.securityStatus.securityLevel;
  }

  async getSessionDuration(): Promise<number | null> {
    if (!this.sessionStartTime) {
      return null;
    }
    
    return Math.floor((Date.now() - this.sessionStartTime.getTime()) / 1000); // seconds
  }

  async validateSecurityIntegrity(): Promise<boolean> {
    try {
      // Check if critical files exist and are accessible
      const criticalFiles = [
        path.join(process.cwd(), 'data', 'config.json'),
        path.join(process.cwd(), 'data', 'token.json'),
        this.securityLogPath
      ];
      
      for (const file of criticalFiles) {
        if (!(await fs.pathExists(file))) {
          await this.logSecurityEvent({
            timestamp: new Date(),
            event: 'integrity_check_failed',
            details: `Critical file missing: ${file}`,
            severity: 'error'
          });
          return false;
        }
      }
      
      await this.logSecurityEvent({
        timestamp: new Date(),
        event: 'integrity_check_passed',
        details: 'Security integrity check passed',
        severity: 'info'
      });
      
      return true;
    } catch (error) {
      this.logger.error('Security integrity check failed:', error);
      return false;
    }
  }
} 