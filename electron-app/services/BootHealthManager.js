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
exports.BootHealthManager = void 0;
const fs = __importStar(require("fs-extra"));
const path = __importStar(require("path"));
const promises_1 = require("fs/promises");
const Logger_1 = require("../utils/Logger");
class BootHealthManager {
    constructor(configManager) {
        this.configManager = configManager;
        this.logger = new Logger_1.Logger();
    }
    async runChecks() {
        const config = this.configManager.getConfig();
        const hc = config.healthCheck;
        if (!hc.enabled) {
            return {
                diskFreeMb: 0,
                diskOk: true,
                networkOk: true,
                gamesDirOk: true,
                networkLatencyMs: null,
                networkError: null,
                allPassed: true,
                errors: []
            };
        }
        const errors = [];
        let diskFreeMb = 0;
        let diskOk = true;
        try {
            const stats = await (0, promises_1.statfs)(process.cwd());
            const bsize = Number(stats.bsize);
            const bavail = Number(stats.bavail);
            diskFreeMb = (bavail * bsize) / (1024 * 1024);
            if (diskFreeMb < hc.minFreeDiskMb) {
                diskOk = false;
                errors.push(`Low disk space: ${diskFreeMb.toFixed(0)} MB free (minimum ${hc.minFreeDiskMb} MB)`);
            }
        }
        catch (e) {
            diskOk = false;
            const msg = e instanceof Error ? e.message : 'Unknown disk check error';
            errors.push(`Disk check failed: ${msg}`);
            this.logger.warn('Boot health disk check failed', e);
        }
        let networkOk = true;
        let networkLatencyMs = null;
        let networkError = null;
        const url = hc.networkCheckUrl?.trim() ||
            (config.network.analyticsEnabled ? config.analytics.endpoint : '') ||
            'https://httpbin.org/get';
        if (url) {
            const start = Date.now();
            try {
                const controller = new AbortController();
                const id = setTimeout(() => controller.abort(), hc.pingTimeoutMs);
                const res = await fetch(url, { method: 'HEAD', signal: controller.signal }).catch(async () => fetch(url, { method: 'GET', signal: controller.signal }));
                clearTimeout(id);
                networkLatencyMs = Date.now() - start;
                if (!res.ok) {
                    networkOk = false;
                    networkError = `HTTP ${res.status}`;
                    errors.push(`Network check failed: ${networkError}`);
                }
            }
            catch (e) {
                networkOk = false;
                networkError = e instanceof Error ? e.message : 'Network error';
                errors.push(`Network check failed: ${networkError}`);
            }
        }
        const games = await this.ensureGamesDirReadable();
        if (!games.ok) {
            errors.push(`Games directory: ${games.error ?? 'not readable'}`);
        }
        const allPassed = diskOk && networkOk && games.ok;
        return {
            diskFreeMb,
            diskOk,
            networkOk,
            gamesDirOk: games.ok,
            networkLatencyMs,
            networkError,
            allPassed,
            errors
        };
    }
    async ensureGamesDirReadable() {
        const gamesDir = path.join(process.cwd(), 'games');
        try {
            await fs.access(gamesDir, fs.constants.R_OK);
            return { ok: true, error: null };
        }
        catch (e) {
            const msg = e instanceof Error ? e.message : 'Cannot read games directory';
            return { ok: false, error: msg };
        }
    }
}
exports.BootHealthManager = BootHealthManager;
