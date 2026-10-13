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
exports.SeasonManager = void 0;
const fs = __importStar(require("fs-extra"));
const path = __importStar(require("path"));
const crypto_1 = require("crypto");
const Logger_1 = require("../utils/Logger");
class SeasonManager {
    constructor(competitionManager, profileManager, analyticsManager) {
        this.seasons = [];
        this.logger = new Logger_1.Logger();
        this.competitionManager = competitionManager;
        this.profileManager = profileManager;
        this.analyticsManager = analyticsManager;
        this.seasonsFile = path.join(process.cwd(), 'data', 'competition-seasons.json');
    }
    async initialize() {
        await fs.ensureDir(path.dirname(this.seasonsFile));
        if (await fs.pathExists(this.seasonsFile)) {
            const store = (await fs.readJson(this.seasonsFile));
            this.seasons = Array.isArray(store.seasons) ? store.seasons : [];
        }
        else {
            this.seasons = [];
            await this.save();
        }
        await this.refreshStatuses();
        this.logger.info(`SeasonManager initialized (${this.seasons.length} seasons)`);
    }
    async save() {
        await fs.writeJson(this.seasonsFile, { seasons: this.seasons }, {
            spaces: 2
        });
    }
    computeStatus(season, now = Date.now()) {
        if (season.status === 'ended')
            return 'ended';
        const start = Date.parse(season.startsAt);
        if (Number.isFinite(start) && start > now)
            return 'upcoming';
        if (season.endsAt) {
            const end = Date.parse(season.endsAt);
            if (Number.isFinite(end) && end < now)
                return 'ended';
        }
        return 'active';
    }
    async refreshStatuses() {
        let changed = false;
        this.seasons = this.seasons.map((s) => {
            const next = this.computeStatus(s);
            if (next !== s.status) {
                changed = true;
                return { ...s, status: next };
            }
            return s;
        });
        if (changed)
            await this.save();
    }
    listSeasons() {
        return [...this.seasons].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    }
    getSeason(id) {
        return this.seasons.find((s) => s.id === id) ?? null;
    }
    getActiveSeason() {
        return this.seasons.find((s) => this.computeStatus(s) === 'active') ?? null;
    }
    async createSeason(input) {
        const draft = {
            id: (0, crypto_1.randomUUID)(),
            name: input.name.trim() || 'Season',
            description: (input.description ?? '').trim(),
            status: 'upcoming',
            startsAt: input.startsAt ?? new Date().toISOString(),
            endsAt: input.endsAt ?? null,
            createdAt: new Date().toISOString()
        };
        const season = { ...draft, status: this.computeStatus(draft) };
        this.seasons.push(season);
        await this.save();
        await this.analyticsManager.trackEvent('season_created', 'game_activity', {
            seasonId: season.id,
            name: season.name
        });
        return season;
    }
    async endSeason(seasonId) {
        const idx = this.seasons.findIndex((s) => s.id === seasonId);
        if (idx < 0)
            return null;
        this.seasons[idx] = {
            ...this.seasons[idx],
            status: 'ended',
            endsAt: this.seasons[idx].endsAt ?? new Date().toISOString()
        };
        await this.save();
        const standings = this.getStandings(seasonId);
        for (const row of standings.slice(0, 50)) {
            if (row.playerId) {
                await this.profileManager.setSeasonalRank(row.playerId, row.rank);
            }
        }
        await this.analyticsManager.trackEvent('season_ended', 'game_activity', {
            seasonId,
            standings: standings.length
        });
        return this.seasons[idx];
    }
    /**
     * Points: 10 / 7 / 5 / 3 / 1 for ranks 1–5 in each competition tagged with this season.
     */
    getStandings(seasonId, limit = 25) {
        const pointsForRank = (rank) => {
            if (rank === 1)
                return 10;
            if (rank === 2)
                return 7;
            if (rank === 3)
                return 5;
            if (rank === 4)
                return 3;
            if (rank === 5)
                return 1;
            return 0;
        };
        const comps = this.competitionManager
            .listCompetitions()
            .filter((c) => c.seasonId === seasonId);
        const map = new Map();
        for (const c of comps) {
            const board = this.competitionManager.getLeaderboard(c.id, 20);
            for (const entry of board) {
                const key = entry.playerId ?? `name:${entry.displayName.toLowerCase()}`;
                const existing = map.get(key) ?? {
                    playerId: entry.playerId,
                    displayName: entry.displayName,
                    points: 0,
                    played: 0,
                    best: 0
                };
                existing.points += pointsForRank(entry.rank);
                existing.played += 1;
                existing.best = Math.max(existing.best, entry.score);
                if (entry.playerId)
                    existing.playerId = entry.playerId;
                map.set(key, existing);
            }
        }
        return Array.from(map.values())
            .sort((a, b) => b.points - a.points || b.best - a.best)
            .slice(0, limit)
            .map((row, index) => ({
            rank: index + 1,
            playerId: row.playerId,
            displayName: row.displayName,
            points: row.points,
            competitionsPlayed: row.played,
            bestScore: row.best
        }));
    }
}
exports.SeasonManager = SeasonManager;
