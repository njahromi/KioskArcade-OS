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
exports.TokenManager = void 0;
const crypto = __importStar(require("crypto"));
const fs = __importStar(require("fs-extra"));
const path = __importStar(require("path"));
const Logger_1 = require("../utils/Logger");
class TokenManager {
    constructor() {
        this.currentToken = null;
        this.logger = new Logger_1.Logger();
        this.tokenFilePath = path.join(process.cwd(), 'data', 'token.json');
        this.arcadeId = this.generateArcadeId();
        this.locationId = this.generateLocationId();
    }
    async initialize() {
        try {
            // Ensure data directory exists
            await fs.ensureDir(path.dirname(this.tokenFilePath));
            // Load existing token or generate new one
            await this.loadOrGenerateToken();
            this.logger.info('TokenManager initialized successfully');
        }
        catch (error) {
            this.logger.error('Failed to initialize TokenManager:', error);
            throw error;
        }
    }
    generateArcadeId() {
        // Generate a unique arcade ID based on hardware characteristics
        const os = require('os');
        const networkInterfaces = os.networkInterfaces();
        const interfaces = Object.values(networkInterfaces).flat();
        const macAddress = interfaces.find((iface) => !iface.internal && iface.mac !== '00:00:00:00:00:00')?.mac || 'unknown';
        const hash = crypto.createHash('sha256');
        hash.update(macAddress + os.hostname() + os.platform());
        return hash.digest('hex').substring(0, 16);
    }
    generateLocationId() {
        // Generate a location ID (in real deployment, this would come from configuration)
        return 'LOC_' + Math.random().toString(36).substring(2, 8).toUpperCase();
    }
    async loadOrGenerateToken() {
        try {
            if (await fs.pathExists(this.tokenFilePath)) {
                const tokenData = await fs.readJson(this.tokenFilePath);
                const expiresAt = new Date(tokenData.expiresAt);
                if (expiresAt > new Date()) {
                    this.currentToken = tokenData;
                    this.logger.info('Loaded existing valid token');
                    return;
                }
                else {
                    this.logger.info('Existing token expired, generating new one');
                }
            }
            await this.generateNewToken();
        }
        catch (error) {
            this.logger.error('Failed to load token, generating new one:', error);
            await this.generateNewToken();
        }
    }
    async generateNewToken() {
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
    async saveToken() {
        try {
            await fs.writeJson(this.tokenFilePath, this.currentToken, { spaces: 2 });
        }
        catch (error) {
            this.logger.error('Failed to save token:', error);
            throw error;
        }
    }
    async publishTokenToPubSub() {
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
        }
        catch (error) {
            this.logger.error('Failed to publish token to Pub/Sub:', error);
            // Don't throw here as token generation should still succeed
        }
    }
    async getCurrentToken() {
        if (!this.currentToken) {
            throw new Error('No token available');
        }
        return this.currentToken.token;
    }
    async getTokenData() {
        return this.currentToken;
    }
    async rotateToken() {
        try {
            await this.generateNewToken();
            this.logger.info('Token rotated successfully');
            return true;
        }
        catch (error) {
            this.logger.error('Failed to rotate token:', error);
            return false;
        }
    }
    async isTokenValid() {
        if (!this.currentToken) {
            return false;
        }
        const now = new Date();
        return now < this.currentToken.expiresAt;
    }
    async getArcadeId() {
        return this.arcadeId;
    }
    async getLocationId() {
        return this.locationId;
    }
    async getTokenExpiry() {
        return this.currentToken?.expiresAt || null;
    }
}
exports.TokenManager = TokenManager;
