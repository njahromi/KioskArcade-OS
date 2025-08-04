import * as fs from 'fs-extra';
import * as path from 'path';
import * as winston from 'winston';

export class Logger {
  private logger: winston.Logger;
  private readonly logDir: string;
  private readonly logFile: string;

  constructor() {
    this.logDir = path.join(process.cwd(), 'logs');
    this.logFile = path.join(this.logDir, 'kioskarcade.log');
    
    this.initializeLogger();
  }

  private initializeLogger(): void {
    // Ensure log directory exists
    fs.ensureDirSync(this.logDir);

    // Create Winston logger
    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
      ),
      defaultMeta: { service: 'kioskarcade' },
      transports: [
        // Console transport
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
          )
        }),
        // File transport
        new winston.transports.File({
          filename: this.logFile,
          maxsize: 5242880, // 5MB
          maxFiles: 5,
          tailable: true
        }),
        // Error file transport
        new winston.transports.File({
          filename: path.join(this.logDir, 'error.log'),
          level: 'error',
          maxsize: 5242880, // 5MB
          maxFiles: 3,
          tailable: true
        })
      ]
    });

    // Handle uncaught exceptions
    this.logger.exceptions.handle(
      new winston.transports.File({
        filename: path.join(this.logDir, 'exceptions.log')
      })
    );

    // Handle unhandled promise rejections
    this.logger.rejections.handle(
      new winston.transports.File({
        filename: path.join(this.logDir, 'rejections.log')
      })
    );
  }

  info(message: string, meta?: any): void {
    this.logger.info(message, meta);
  }

  warn(message: string, meta?: any): void {
    this.logger.warn(message, meta);
  }

  error(message: string, meta?: any): void {
    this.logger.error(message, meta);
  }

  debug(message: string, meta?: any): void {
    this.logger.debug(message, meta);
  }

  verbose(message: string, meta?: any): void {
    this.logger.verbose(message, meta);
  }

  async getLogs(limit: number = 100): Promise<string[]> {
    try {
      if (await fs.pathExists(this.logFile)) {
        const logData = await fs.readFile(this.logFile, 'utf8');
        const lines = logData.split('\n').filter(line => line.trim());
        return lines.slice(-limit);
      }
      return [];
    } catch (error) {
      this.error('Failed to read log file:', error);
      return [];
    }
  }

  async clearLogs(): Promise<boolean> {
    try {
      await fs.writeFile(this.logFile, '');
      this.info('Logs cleared by administrator');
      return true;
    } catch (error) {
      this.error('Failed to clear logs:', error);
      return false;
    }
  }

  async getLogStats(): Promise<{
    totalLines: number;
    errorCount: number;
    warningCount: number;
    infoCount: number;
    lastModified: Date;
  }> {
    try {
      if (!(await fs.pathExists(this.logFile))) {
        return {
          totalLines: 0,
          errorCount: 0,
          warningCount: 0,
          infoCount: 0,
          lastModified: new Date()
        };
      }

      const logData = await fs.readFile(this.logFile, 'utf8');
      const lines = logData.split('\n').filter(line => line.trim());
      
      let errorCount = 0;
      let warningCount = 0;
      let infoCount = 0;

      for (const line of lines) {
        try {
          const logEntry = JSON.parse(line);
          if (logEntry.level === 'error') errorCount++;
          else if (logEntry.level === 'warn') warningCount++;
          else if (logEntry.level === 'info') infoCount++;
        } catch {
          // Skip invalid JSON lines
        }
      }

      const stats = await fs.stat(this.logFile);

      return {
        totalLines: lines.length,
        errorCount,
        warningCount,
        infoCount,
        lastModified: stats.mtime
      };
    } catch (error) {
      this.error('Failed to get log stats:', error);
      return {
        totalLines: 0,
        errorCount: 0,
        warningCount: 0,
        infoCount: 0,
        lastModified: new Date()
      };
    }
  }

  async rotateLogs(): Promise<boolean> {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const rotatedLogFile = path.join(this.logDir, `kioskarcade-${timestamp}.log`);
      
      if (await fs.pathExists(this.logFile)) {
        await fs.move(this.logFile, rotatedLogFile);
      }
      
      this.info('Logs rotated successfully');
      return true;
    } catch (error) {
      this.error('Failed to rotate logs:', error);
      return false;
    }
  }

  // Log specific arcade events
  logGameLaunch(gameId: string, success: boolean): void {
    this.info(`Game launch: ${gameId}`, { 
      gameId, 
      success, 
      timestamp: new Date().toISOString() 
    });
  }

  logAdminAction(action: string, success: boolean, details?: any): void {
    this.info(`Admin action: ${action}`, { 
      action, 
      success, 
      details, 
      timestamp: new Date().toISOString() 
    });
  }

  logSecurityEvent(event: string, severity: 'info' | 'warning' | 'error' | 'critical', details?: any): void {
    const logMethod = severity === 'error' || severity === 'critical' ? 'error' : 
                     severity === 'warning' ? 'warn' : 'info';
    
    this[logMethod](`Security event: ${event}`, { 
      event, 
      severity, 
      details, 
      timestamp: new Date().toISOString() 
    });
  }

  logNetworkEvent(event: string, success: boolean, details?: any): void {
    this.info(`Network event: ${event}`, { 
      event, 
      success, 
      details, 
      timestamp: new Date().toISOString() 
    });
  }

  logSystemEvent(event: string, details?: any): void {
    this.info(`System event: ${event}`, { 
      event, 
      details, 
      timestamp: new Date().toISOString() 
    });
  }
} 