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
const MAX_ATTEMPTS = 8;
/**
 * File-based venue hub transport for local/dev Phase 3.
 * Point multiple cabinets at the same hubDir (network share or shared folder)
 * to exchange competition results without a cloud backend.
 */
class FileHubTransport {
    constructor(hubDir) {
        this.hubDir = hubDir;
    }
    getHubDir() {
        return this.hubDir;
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
        // Cap hub size to avoid unbounded growth
        const capped = existing.slice(-5000);
        await fs.writeJson(this.inboxPath(), { items: capped, updatedAt: new Date().toISOString() }, { spaces: 2 });
        return { accepted, failed: [] };
    }
    async pull(since) {
        await fs.ensureDir(this.hubDir);
        if (!(await fs.pathExists(this.inboxPath()))) {
            return { items: [], cursor: since ?? new Date(0).toISOString() };
        }
        const raw = await fs.readJson(this.inboxPath());
        const items = Array.isArray(raw.items) ? raw.items : [];
        const filtered = since ? items.filter((i) => i.createdAt > since) : items;
        const cursor = filtered.reduce((max, i) => (i.createdAt > max ? i.createdAt : max), since ?? new Date(0).toISOString());
        return { items: filtered, cursor };
    }
}
exports.FileHubTransport = FileHubTransport;
class CompetitionSyncService {
    constructor(competitionManager, transport) {
        this.queue = [];
        this.lastPullCursor = null;
        this.lastSyncAt = null;
        this.lastResult = null;
        this.timer = null;
        this.arcadeId = 'local';
        this.onSyncComplete = null;
        this.logger = new Logger_1.Logger();
        this.configManager = AppConfig_1.ConfigManager.getInstance();
        this.competitionManager = competitionManager;
        this.storeFile = path.join(process.cwd(), 'data', 'competition-sync-queue.json');
        this.usesCustomTransport = !!transport;
        this.transport =
            transport ?? new FileHubTransport(this.configManager.getCompetitionHubDir());
    }
    setArcadeId(arcadeId) {
        this.arcadeId = arcadeId;
    }
    setOnSyncComplete(handler) {
        this.onSyncComplete = handler;
    }
    async initialize() {
        await fs.ensureDir(path.dirname(this.storeFile));
        if (await fs.pathExists(this.storeFile)) {
            const store = (await fs.readJson(this.storeFile));
            this.queue = Array.isArray(store.queue)
                ? store.queue.map((q) => ({
                    ...q,
                    originArcadeId: q.originArcadeId ?? 'unknown'
                }))
                : [];
            this.lastPullCursor = store.lastPullCursor ?? null;
            this.lastSyncAt = store.lastSyncAt ?? null;
            this.lastResult = store.lastResult ?? null;
        }
        else {
            await this.save();
        }
        if (!this.usesCustomTransport) {
            this.transport = new FileHubTransport(this.configManager.getCompetitionHubDir());
        }
        if (this.configManager.isCompetitionSyncEnabled()) {
            this.startTimer();
            this.logger.info(`CompetitionSyncService started hub=${this.transport.getHubDir()}`);
        }
        else {
            this.logger.info('Competition sync disabled');
        }
    }
    startTimer() {
        this.stop();
        const interval = this.configManager.getConfig().competitions.syncIntervalMs;
        this.timer = setInterval(() => {
            void this.syncNow();
        }, interval);
    }
    stop() {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
    }
    async setEnabled(enabled) {
        this.configManager.setCompetitionSyncEnabled(enabled);
        if (enabled) {
            if (!this.usesCustomTransport) {
                this.transport = new FileHubTransport(this.configManager.getCompetitionHubDir());
            }
            this.startTimer();
            await this.syncNow();
        }
        else {
            this.stop();
        }
        return this.getStatus();
    }
    async save() {
        const store = {
            queue: this.queue,
            lastPullCursor: this.lastPullCursor,
            lastSyncAt: this.lastSyncAt,
            lastResult: this.lastResult
        };
        await fs.writeJson(this.storeFile, store, { spaces: 2 });
    }
    enqueue(kind, payload) {
        this.queue.push({
            id: (0, crypto_1.randomUUID)(),
            kind,
            payload,
            createdAt: new Date().toISOString(),
            attempts: 0,
            lastError: null,
            originArcadeId: this.arcadeId
        });
        void this.save();
    }
    enqueueScore(submission) {
        this.enqueue('score', { ...submission, arcadeId: submission.arcadeId ?? this.arcadeId });
    }
    enqueueCompetition(competition) {
        this.enqueue('competition', competition);
    }
    getQueue() {
        return [...this.queue];
    }
    getStatus() {
        return {
            enabled: this.configManager.isCompetitionSyncEnabled(),
            queueDepth: this.queue.length,
            lastPullCursor: this.lastPullCursor,
            lastSyncAt: this.lastSyncAt,
            lastResult: this.lastResult,
            hubDir: this.transport.getHubDir(),
            arcadeId: this.arcadeId
        };
    }
    async syncNow() {
        if (!this.configManager.isCompetitionSyncEnabled()) {
            return { pushed: 0, pulled: 0 };
        }
        let pushed = 0;
        let pulled = 0;
        try {
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
                    : { ...i, attempts: i.attempts + 1, lastError: i.lastError ?? 'not_accepted' })
                    .filter((i) => i.attempts < MAX_ATTEMPTS);
                await this.save();
            }
            const pull = await this.transport.pull(this.lastPullCursor);
            for (const item of pull.items) {
                if (item.originArcadeId && item.originArcadeId === this.arcadeId)
                    continue;
                if (item.kind === 'score') {
                    const score = item.payload;
                    if (score.arcadeId === this.arcadeId)
                        continue;
                    const merged = await this.competitionManager.mergeRemoteSubmission(score);
                    if (merged === 'inserted' || merged === 'replaced')
                        pulled += 1;
                }
                else if (item.kind === 'competition') {
                    await this.competitionManager.mergeRemoteCompetition(item.payload);
                    pulled += 1;
                }
            }
            this.lastPullCursor = pull.cursor;
            this.lastSyncAt = new Date().toISOString();
            this.lastResult = { pushed, pulled };
            await this.save();
            this.logger.info(`Competition sync complete pushed=${pushed} pulled=${pulled}`);
            this.onSyncComplete?.(this.getStatus());
            return { pushed, pulled };
        }
        catch (error) {
            this.logger.error('Competition sync failed:', error);
            this.lastResult = { pushed, pulled };
            await this.save();
            return { pushed, pulled };
        }
    }
}
exports.CompetitionSyncService = CompetitionSyncService;
