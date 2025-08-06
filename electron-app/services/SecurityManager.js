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
exports.SecurityManager = void 0;
const fs = __importStar(require("fs-extra"));
const path = __importStar(require("path"));
const Logger_1 = require("../utils/Logger");
class SecurityManager {
    constructor() {
        this.events = [];
        this.sessionStartTime = null;
        this.logger = new Logger_1.Logger();
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
    async initialize() {
        try {
            await fs.ensureDir(path.dirname(this.securityLogPath));
            await this.loadSecurityLog();
            await this.performSecurityCheck();
            this.logger.info('SecurityManager initialized successfully');
        }
        catch (error) {
            this.logger.error('Failed to initialize SecurityManager:', error);
            throw error;
        }
    }
    async loadSecurityLog() {
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
                    }
                    catch {
                        // Skip invalid JSON lines
                    }
                });
                this.logger.info(`Loaded ${this.events.length} security events`);
            }
        }
        catch (error) {
            this.logger.error('Failed to load security log:', error);
        }
    }
    async logSecurityEvent(event) {
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
        }
        catch (error) {
            this.logger.error('Failed to log security event:', error);
        }
    }
    async enableLockdown() {
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
        }
        catch (error) {
            this.logger.error('Failed to enable lockdown:', error);
            return false;
        }
    }
    async disableLockdown() {
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
        }
        catch (error) {
            this.logger.error('Failed to disable lockdown:', error);
            return false;
        }
    }
    async startAdminSession() {
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
        }
        catch (error) {
            this.logger.error('Failed to start admin session:', error);
            return false;
        }
    }
    async endAdminSession() {
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
        }
        catch (error) {
            this.logger.error('Failed to end admin session:', error);
            return false;
        }
    }
    async getStatus() {
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
    async performSecurityCheck() {
        try {
            // Check for suspicious activities
            const recentEvents = this.events.filter(event => event.timestamp.getTime() > Date.now() - 24 * 60 * 60 * 1000 // Last 24 hours
            );
            const errorEvents = recentEvents.filter(event => event.severity === 'error' || event.severity === 'critical');
            const warningEvents = recentEvents.filter(event => event.severity === 'warning');
            // Update security level based on events
            if (errorEvents.length > 5) {
                this.securityStatus.securityLevel = 'critical';
            }
            else if (errorEvents.length > 2 || warningEvents.length > 10) {
                this.securityStatus.securityLevel = 'high';
            }
            else if (warningEvents.length > 5) {
                this.securityStatus.securityLevel = 'medium';
            }
            else {
                this.securityStatus.securityLevel = 'low';
            }
            await this.logSecurityEvent({
                timestamp: new Date(),
                event: 'security_check',
                details: `Security check completed. Level: ${this.securityStatus.securityLevel}`,
                severity: 'info'
            });
            this.logger.info(`Security check completed. Level: ${this.securityStatus.securityLevel}`);
        }
        catch (error) {
            this.logger.error('Failed to perform security check:', error);
        }
    }
    async logSecurityViolation(violation, details) {
        await this.logSecurityEvent({
            timestamp: new Date(),
            event: 'security_violation',
            details: `${violation}: ${details}`,
            severity: 'error'
        });
        // If multiple violations occur, increase security level
        const recentViolations = this.events.filter(event => event.event === 'security_violation' &&
            event.timestamp.getTime() > Date.now() - 60 * 60 * 1000 // Last hour
        );
        if (recentViolations.length > 3) {
            this.securityStatus.securityLevel = 'critical';
            await this.enableLockdown();
        }
    }
    async getSecurityEvents(limit = 50) {
        return this.events.slice(-limit).reverse();
    }
    async clearSecurityLog() {
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
        }
        catch (error) {
            this.logger.error('Failed to clear security log:', error);
            return false;
        }
    }
    async isLockdownEnabled() {
        return this.securityStatus.lockdownEnabled;
    }
    async isAdminSessionActive() {
        return this.securityStatus.sessionActive;
    }
    async getSecurityLevel() {
        return this.securityStatus.securityLevel;
    }
    async getSessionDuration() {
        if (!this.sessionStartTime) {
            return null;
        }
        return Math.floor((Date.now() - this.sessionStartTime.getTime()) / 1000); // seconds
    }
    async validateSecurityIntegrity() {
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
        }
        catch (error) {
            this.logger.error('Security integrity check failed:', error);
            return false;
        }
    }
}
exports.SecurityManager = SecurityManager;
