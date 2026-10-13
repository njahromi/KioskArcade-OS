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
exports.AchievementManager = void 0;
const fs = __importStar(require("fs-extra"));
const path = __importStar(require("path"));
const Logger_1 = require("../utils/Logger");
const DEFAULT_ACHIEVEMENTS = [
    {
        id: 'tetris_100',
        gameId: 'tetris',
        name: 'Line Clearer',
        description: 'Score at least 100 in Tetris',
        rule: { type: 'score_at_least', value: 100 }
    },
    {
        id: 'tetris_lines_20',
        gameId: 'tetris',
        name: 'Stack Master',
        description: 'Clear 20 lines in a session',
        rule: { type: 'progress_field_at_least', field: 'lines', value: 20 }
    },
    {
        id: 'snake_50',
        gameId: 'snake',
        name: 'Growing Fast',
        description: 'Score at least 50 in Snake',
        rule: { type: 'score_at_least', value: 50 }
    },
    {
        id: 'snake_length_15',
        gameId: 'snake',
        name: 'Long Snake',
        description: 'Reach length 15',
        rule: { type: 'progress_field_at_least', field: 'length', value: 15 }
    },
    {
        id: 'pong_20',
        gameId: 'pong',
        name: 'Rally Starter',
        description: 'Score at least 20 in Pong',
        rule: { type: 'score_at_least', value: 20 }
    }
];
class AchievementManager {
    constructor(profileManager, definitions) {
        this.unlocks = [];
        this.logger = new Logger_1.Logger();
        this.profileManager = profileManager;
        this.definitions = definitions ?? DEFAULT_ACHIEVEMENTS;
        this.unlocksFile = path.join(process.cwd(), 'data', 'achievement-unlocks.json');
    }
    async initialize() {
        await fs.ensureDir(path.dirname(this.unlocksFile));
        if (await fs.pathExists(this.unlocksFile)) {
            const store = (await fs.readJson(this.unlocksFile));
            this.unlocks = Array.isArray(store.unlocks) ? store.unlocks : [];
        }
        else {
            this.unlocks = [];
            await this.save();
        }
        this.logger.info(`AchievementManager initialized (${this.definitions.length} definitions)`);
    }
    async save() {
        await fs.writeJson(this.unlocksFile, { unlocks: this.unlocks }, {
            spaces: 2
        });
    }
    listDefinitions() {
        return [...this.definitions];
    }
    listUnlocks(playerId) {
        if (!playerId)
            return [...this.unlocks];
        return this.unlocks.filter((u) => u.playerId === playerId);
    }
    matches(def, score, progress) {
        if (def.rule.type === 'score_at_least') {
            return score >= def.rule.value;
        }
        const value = progress?.[def.rule.field];
        return typeof value === 'number' && value >= def.rule.value;
    }
    currentToward(def, personalBests, lastProgress) {
        if (def.rule.type === 'score_at_least') {
            if (def.gameId === '*') {
                return Math.max(0, ...Object.values(personalBests), 0);
            }
            return personalBests[def.gameId] ?? 0;
        }
        const fromProgress = lastProgress?.[def.rule.field];
        if (typeof fromProgress === 'number')
            return fromProgress;
        // Approximate progress fields from personal best when no live progress is available
        if (def.rule.field === 'lines' || def.rule.field === 'length') {
            return personalBests[def.gameId === '*' ? 'tetris' : def.gameId] ?? 0;
        }
        return 0;
    }
    getProgressForPlayer(playerId, personalBests = {}, lastProgress) {
        const unlocks = this.listUnlocks(playerId);
        return this.definitions.map((def) => {
            const unlock = unlocks.find((u) => u.achievementId === def.id);
            const target = def.rule.type === 'score_at_least' ? def.rule.value : def.rule.value;
            const current = unlock ? target : this.currentToward(def, personalBests, lastProgress);
            return {
                achievementId: def.id,
                name: def.name,
                description: def.description,
                gameId: def.gameId,
                unlocked: !!unlock,
                unlockedAt: unlock?.unlockedAt ?? null,
                progress: Math.max(0, Math.min(1, target > 0 ? current / target : 0)),
                currentValue: current,
                targetValue: target
            };
        });
    }
    async evaluateSubmission(submission) {
        if (!submission.playerId || submission.validation === 'rejected') {
            return [];
        }
        const newlyUnlocked = [];
        for (const def of this.definitions) {
            if (def.gameId !== '*' && def.gameId !== submission.gameId)
                continue;
            const already = this.unlocks.some((u) => u.playerId === submission.playerId && u.achievementId === def.id);
            if (already)
                continue;
            if (!this.matches(def, submission.score, submission.progress))
                continue;
            const unlock = {
                achievementId: def.id,
                playerId: submission.playerId,
                unlockedAt: new Date().toISOString(),
                competitionId: submission.competitionId
            };
            this.unlocks.push(unlock);
            await this.profileManager.addAchievement(submission.playerId, def.id);
            newlyUnlocked.push(unlock);
            this.logger.info(`Achievement unlocked: ${def.id} for ${submission.playerId}`);
        }
        if (newlyUnlocked.length > 0) {
            await this.save();
        }
        return newlyUnlocked;
    }
}
exports.AchievementManager = AchievementManager;
