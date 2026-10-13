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
exports.PlayerProfileManager = void 0;
const fs = __importStar(require("fs-extra"));
const path = __importStar(require("path"));
const crypto = __importStar(require("crypto"));
const crypto_1 = require("crypto");
const Logger_1 = require("../utils/Logger");
class PlayerProfileManager {
    constructor() {
        this.profiles = [];
        this.logger = new Logger_1.Logger();
        this.profilesFile = path.join(process.cwd(), 'data', 'player-profiles.json');
    }
    async initialize() {
        await fs.ensureDir(path.dirname(this.profilesFile));
        if (await fs.pathExists(this.profilesFile)) {
            const store = (await fs.readJson(this.profilesFile));
            this.profiles = Array.isArray(store.profiles) ? store.profiles : [];
        }
        else {
            this.profiles = [];
            await this.save();
        }
        this.logger.info(`PlayerProfileManager initialized (${this.profiles.length} profiles)`);
    }
    async save() {
        await fs.writeJson(this.profilesFile, { profiles: this.profiles }, {
            spaces: 2
        });
    }
    hashPin(pin) {
        return crypto.createHash('sha256').update(`kioskarcade:${pin}`).digest('hex');
    }
    listProfiles() {
        return [...this.profiles];
    }
    getProfile(playerId) {
        return this.profiles.find((p) => p.id === playerId) ?? null;
    }
    findByQrPayload(qrPayload) {
        return this.profiles.find((p) => p.qrPayload === qrPayload) ?? null;
    }
    async createProfile(displayName, pin) {
        const id = (0, crypto_1.randomUUID)();
        const profile = {
            id,
            displayName: displayName.trim().slice(0, 24) || 'Player',
            pinHash: pin ? this.hashPin(pin) : null,
            qrPayload: `kioskarcade:player:${id}`,
            createdAt: new Date().toISOString(),
            personalBests: {},
            achievementIds: [],
            tournamentHistory: [],
            seasonalRank: null
        };
        this.profiles.push(profile);
        await this.save();
        return profile;
    }
    verifyPin(playerId, pin) {
        const profile = this.getProfile(playerId);
        if (!profile?.pinHash)
            return true;
        return profile.pinHash === this.hashPin(pin);
    }
    async updatePersonalBest(playerId, gameId, score) {
        const idx = this.profiles.findIndex((p) => p.id === playerId);
        if (idx < 0)
            return false;
        const profile = this.profiles[idx];
        const current = profile.personalBests[gameId] ?? 0;
        if (score <= current)
            return false;
        this.profiles[idx] = {
            ...profile,
            personalBests: { ...profile.personalBests, [gameId]: score }
        };
        await this.save();
        return true;
    }
    async recordTournament(playerId, competitionId) {
        const idx = this.profiles.findIndex((p) => p.id === playerId);
        if (idx < 0)
            return;
        const profile = this.profiles[idx];
        if (profile.tournamentHistory.includes(competitionId))
            return;
        this.profiles[idx] = {
            ...profile,
            tournamentHistory: [...profile.tournamentHistory, competitionId]
        };
        await this.save();
    }
    async addAchievement(playerId, achievementId) {
        const idx = this.profiles.findIndex((p) => p.id === playerId);
        if (idx < 0)
            return false;
        const profile = this.profiles[idx];
        if (profile.achievementIds.includes(achievementId))
            return false;
        this.profiles[idx] = {
            ...profile,
            achievementIds: [...profile.achievementIds, achievementId]
        };
        await this.save();
        return true;
    }
    async setSeasonalRank(playerId, rank) {
        const idx = this.profiles.findIndex((p) => p.id === playerId);
        if (idx < 0)
            return;
        this.profiles[idx] = { ...this.profiles[idx], seasonalRank: rank };
        await this.save();
    }
}
exports.PlayerProfileManager = PlayerProfileManager;
