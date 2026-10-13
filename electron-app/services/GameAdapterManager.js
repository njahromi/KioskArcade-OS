"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GameAdapterManager = void 0;
function isRecord(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function parseProgress(raw) {
    if (!isRecord(raw))
        return null;
    const progress = {
        level: typeof raw.level === 'number' ? raw.level : undefined,
        elapsedMs: typeof raw.elapsedMs === 'number' ? raw.elapsedMs : undefined,
        completed: typeof raw.completed === 'boolean' ? raw.completed : undefined,
        lines: typeof raw.lines === 'number' ? raw.lines : undefined,
        length: typeof raw.length === 'number' ? raw.length : undefined
    };
    return progress;
}
function createAdapter(gameId, plausibleRange) {
    return {
        gameId,
        plausibleRange,
        isSupported() {
            return true;
        },
        normalizeScoreEvent(raw) {
            if (!isRecord(raw))
                return null;
            const type = raw.type;
            if (type !== 'kioskarcade:score' && type !== undefined) {
                // Allow bare payloads from guest preload without type wrapper
                if (typeof raw.score !== 'number')
                    return null;
            }
            const id = typeof raw.gameId === 'string' ? raw.gameId : gameId;
            if (id !== gameId)
                return null;
            const score = typeof raw.score === 'number' ? raw.score : null;
            if (score === null || !Number.isFinite(score))
                return null;
            const event = raw.event === 'final' ? 'final' : 'update';
            return {
                gameId: id,
                score: Math.floor(score),
                event,
                progress: parseProgress(raw.progress),
                reportedAt: typeof raw.reportedAt === 'string' ? raw.reportedAt : new Date().toISOString()
            };
        }
    };
}
class GameAdapterManager {
    constructor() {
        this.adapters = new Map();
        this.register(createAdapter('tetris', { min: 0, max: 999999 }));
        this.register(createAdapter('snake', { min: 0, max: 100000 }));
        this.register(createAdapter('pong', { min: 0, max: 50000 }));
    }
    register(adapter) {
        this.adapters.set(adapter.gameId, adapter);
    }
    getAdapter(gameId) {
        return this.adapters.get(gameId) ?? null;
    }
    isSupported(gameId) {
        const adapter = this.adapters.get(gameId);
        return adapter?.isSupported() === true;
    }
    listSupportedGameIds() {
        return Array.from(this.adapters.keys()).filter((id) => this.adapters.get(id)?.isSupported());
    }
    normalize(gameId, raw) {
        const adapter = this.getAdapter(gameId);
        if (!adapter)
            return null;
        return adapter.normalizeScoreEvent(raw);
    }
}
exports.GameAdapterManager = GameAdapterManager;
