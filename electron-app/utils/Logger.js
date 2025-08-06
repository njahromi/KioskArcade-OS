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
exports.Logger = void 0;
const fs = __importStar(require("fs-extra"));
const path = __importStar(require("path"));
const winston = __importStar(require("winston"));
class Logger {
    constructor() {
        this.logDir = path.join(process.cwd(), 'logs');
        this.logFile = path.join(this.logDir, 'kioskarcade.log');
        this.initializeLogger();
    }
    initializeLogger() {
        // Ensure log directory exists
        fs.ensureDirSync(this.logDir);
        // Create Winston logger
        this.logger = winston.createLogger({
            level: 'info',
            format: winston.format.combine(winston.format.timestamp(), winston.format.errors({ stack: true }), winston.format.json()),
            defaultMeta: { service: 'kioskarcade' },
            transports: [
                // Console transport
                new winston.transports.Console({
                    format: winston.format.combine(winston.format.colorize(), winston.format.simple())
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
        this.logger.exceptions.handle(new winston.transports.File({
            filename: path.join(this.logDir, 'exceptions.log')
        }));
        // Handle unhandled promise rejections
        this.logger.rejections.handle(new winston.transports.File({
            filename: path.join(this.logDir, 'rejections.log')
        }));
    }
    info(message, meta) {
        this.logger.info(message, meta);
    }
    warn(message, meta) {
        this.logger.warn(message, meta);
    }
    error(message, meta) {
        this.logger.error(message, meta);
    }
    debug(message, meta) {
        this.logger.debug(message, meta);
    }
    verbose(message, meta) {
        this.logger.verbose(message, meta);
    }
    async getLogs(limit = 100) {
        try {
            if (await fs.pathExists(this.logFile)) {
                const logData = await fs.readFile(this.logFile, 'utf8');
                const lines = logData.split('\n').filter(line => line.trim());
                return lines.slice(-limit);
            }
            return [];
        }
        catch (error) {
            this.error('Failed to read log file:', error);
            return [];
        }
    }
    async clearLogs() {
        try {
            await fs.writeFile(this.logFile, '');
            this.info('Logs cleared by administrator');
            return true;
        }
        catch (error) {
            this.error('Failed to clear logs:', error);
            return false;
        }
    }
    async getLogStats() {
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
                    if (logEntry.level === 'error')
                        errorCount++;
                    else if (logEntry.level === 'warn')
                        warningCount++;
                    else if (logEntry.level === 'info')
                        infoCount++;
                }
                catch {
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
        }
        catch (error) {
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
    async rotateLogs() {
        try {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const rotatedLogFile = path.join(this.logDir, `kioskarcade-${timestamp}.log`);
            if (await fs.pathExists(this.logFile)) {
                await fs.move(this.logFile, rotatedLogFile);
            }
            this.info('Logs rotated successfully');
            return true;
        }
        catch (error) {
            this.error('Failed to rotate logs:', error);
            return false;
        }
    }
    // Log specific arcade events
    logGameLaunch(gameId, success) {
        this.info(`Game launch: ${gameId}`, {
            gameId,
            success,
            timestamp: new Date().toISOString()
        });
    }
    logAdminAction(action, success, details) {
        this.info(`Admin action: ${action}`, {
            action,
            success,
            details,
            timestamp: new Date().toISOString()
        });
    }
    logSecurityEvent(event, severity, details) {
        const logMethod = severity === 'error' || severity === 'critical' ? 'error' :
            severity === 'warning' ? 'warn' : 'info';
        this[logMethod](`Security event: ${event}`, {
            event,
            severity,
            details,
            timestamp: new Date().toISOString()
        });
    }
    logNetworkEvent(event, success, details) {
        this.info(`Network event: ${event}`, {
            event,
            success,
            details,
            timestamp: new Date().toISOString()
        });
    }
    logSystemEvent(event, details) {
        this.info(`System event: ${event}`, {
            event,
            details,
            timestamp: new Date().toISOString()
        });
    }
}
exports.Logger = Logger;
