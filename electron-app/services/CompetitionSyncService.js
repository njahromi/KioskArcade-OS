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
exports.CompetitionSyncService = exports.FileHubTransport = void 0;
const fs = __importStar(require("fs-extra"));
const path = __importStar(require("path"));
const crypto_1 = require("crypto");
const Logger_1 = require("../utils/Logger");
const AppConfig_1 = require("../config/AppConfig");
/**
 * File-based venue hub transport for local/dev Phase 3.
 * Writes/reads shared JSON under data/competition-hub/ so multiple cabinets
 * on the same machine (or shared folder) can exchange results.
 */
class FileHubTransport {
    constructor(hubDir) {
        this.hubDir = hubDir;
    }
    inboxPath() {
        return path.join(this.hubDir, 'inbox.json');
    }
    async push(items) {
        await fs.ensureDir(this.hubDir);
        let existing = [];
        if (await fs.pathExists(this.inboxPath())) {
            const raw = await fs.readJson(this.inboxPath());
            existing = Array.isArray(raw.items) ? raw.items : [];
        }
        const accepted = [];
        for (const item of items) {
            if (!existing.some((e) => e.id === item.id)) {
                existing.push(item);
            }
            accepted.push(item.id);
        }
        await fs.writeJson(this.inboxPath(), { items: existing, updatedAt: new Date().toISOString() }, { spaces: 2 });
        return { accepted, failed: [] };
    }
    async pull(since) {
        await fs.ensureDir(this.hubDir);
        if (!(await fs.pathExists(this.inboxPath()))) {
            return { items: [], cursor: since ?? new Date(0).toISOString() };
        }
        const raw = await fs.readJson(this.inboxPath());
        const items = Array.isArray(raw.items) ? raw.items : [];
        const filtered = since
            ? items.filter((i) => i.createdAt > since)
            : items;
        const cursor = filtered.reduce((max, i) => (i.createdAt > max ? i.createdAt : max), since ?? new Date(0).toISOString());
        return { items: filtered, cursor };
    }
}
exports.FileHubTransport = FileHubTransport;
class CompetitionSyncService {
    constructor(competitionManager, transport) {
        this.queue = [];
        this.lastPullCursor = null;
        this.timer = null;
        this.arcadeId = 'local';
        this.logger = new Logger_1.Logger();
        this.configManager = AppConfig_1.ConfigManager.getInstance();
        this.competitionManager = competitionManager;
        this.storeFile = path.join(process.cwd(), 'data', 'competition-sync-queue.json');
        this.transport =
            transport ??
                new FileHubTransport(path.join(process.cwd(), 'data', 'competition-hub'));
    }
    setArcadeId(arcadeId) {
        this.arcadeId = arcadeId;
    }
    async initialize() {
        await fs.ensureDir(path.dirname(this.storeFile));
        if (await fs.pathExists(this.storeFile)) {
            const store = (await fs.readJson(this.storeFile));
            this.queue = Array.isArray(store.queue) ? store.queue : [];
            this.lastPullCursor = store.lastPullCursor ?? null;
        }
        else {
            await this.save();
        }
        if (this.configManager.isCompetitionSyncEnabled()) {
            const interval = this.configManager.getConfig().competitions.syncIntervalMs;
            this.timer = setInterval(() => {
                void this.syncNow();
            }, interval);
            this.logger.info('CompetitionSyncService started');
        }
        else {
            this.logger.info('Competition sync disabled');
        }
    }
    stop() {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
    }
    async save() {
        const store = { queue: this.queue, lastPullCursor: this.lastPullCursor };
        await fs.writeJson(this.storeFile, store, { spaces: 2 });
    }
    enqueue(kind, payload) {
        this.queue.push({
            id: (0, crypto_1.randomUUID)(),
            kind,
            payload,
            createdAt: new Date().toISOString(),
            attempts: 0,
            lastError: null
        });
        void this.save();
    }
    enqueueScore(submission) {
        this.enqueue('score', submission);
    }
    enqueueCompetition(competition) {
        this.enqueue('competition', competition);
    }
    getQueue() {
        return [...this.queue];
    }
    async syncNow() {
        if (!this.configManager.isCompetitionSyncEnabled()) {
            return { pushed: 0, pulled: 0 };
        }
        let pushed = 0;
        let pulled = 0;
        if (this.queue.length > 0) {
            const pending = [...this.queue];
            const result = await this.transport.push(pending);
            const accepted = new Set(result.accepted);
            const failedMap = new Map(result.failed.map((f) => [f.id, f.error]));
            pushed = accepted.size;
            this.queue = pending
                .filter((i) => !accepted.has(i.id))
                .map((i) => failedMap.has(i.id)
                ? {
                    ...i,
                    attempts: i.attempts + 1,
                    lastError: failedMap.get(i.id) ?? i.lastError
                }
                : i);
            await this.save();
        }
        const pull = await this.transport.pull(this.lastPullCursor);
        for (const item of pull.items) {
            // Skip our own echo if payload carries arcadeId matching us
            if (item.kind === 'score') {
                const score = item.payload;
                if (score.arcadeId === this.arcadeId)
                    continue;
                const merged = await this.competitionManager.mergeRemoteSubmission(score);
                if (merged)
                    pulled += 1;
            }
            else if (item.kind === 'competition') {
                const competition = item.payload;
                await this.competitionManager.mergeRemoteCompetition(competition);
                pulled += 1;
            }
        }
        this.lastPullCursor = pull.cursor;
        await this.save();
        this.logger.info(`Competition sync complete pushed=${pushed} pulled=${pulled}`);
        return { pushed, pulled };
    }
}
exports.CompetitionSyncService = CompetitionSyncService;
