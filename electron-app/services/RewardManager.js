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
exports.RewardManager = void 0;
const fs = __importStar(require("fs-extra"));
const path = __importStar(require("path"));
const crypto_1 = require("crypto");
const Logger_1 = require("../utils/Logger");
class RewardManager {
    constructor(analyticsManager) {
        this.rewards = [];
        this.redemptions = [];
        this.logger = new Logger_1.Logger();
        this.analyticsManager = analyticsManager;
        this.storeFile = path.join(process.cwd(), 'data', 'competition-rewards.json');
    }
    async initialize() {
        await fs.ensureDir(path.dirname(this.storeFile));
        if (await fs.pathExists(this.storeFile)) {
            const store = (await fs.readJson(this.storeFile));
            this.rewards = Array.isArray(store.rewards) ? store.rewards : [];
            this.redemptions = Array.isArray(store.redemptions) ? store.redemptions : [];
        }
        else {
            this.rewards = [];
            this.redemptions = [];
            await this.save();
        }
        this.logger.info(`RewardManager initialized (${this.rewards.length} rewards, ${this.redemptions.length} redemptions)`);
    }
    async save() {
        const store = { rewards: this.rewards, redemptions: this.redemptions };
        await fs.writeJson(this.storeFile, store, { spaces: 2 });
    }
    listRewards(activeOnly = false) {
        return this.rewards.filter((r) => !activeOnly || r.active);
    }
    listRedemptions(status) {
        if (!status)
            return [...this.redemptions];
        return this.redemptions.filter((r) => r.status === status);
    }
    async createReward(input) {
        const reward = {
            id: (0, crypto_1.randomUUID)(),
            name: input.name.trim(),
            type: input.type,
            description: input.description.trim(),
            requiresStaffApproval: input.requiresStaffApproval,
            competitionId: input.competitionId ?? null,
            active: true,
            createdAt: new Date().toISOString()
        };
        this.rewards.push(reward);
        await this.save();
        await this.analyticsManager.trackEvent('reward_created', 'game_activity', {
            rewardId: reward.id,
            type: reward.type
        });
        return reward;
    }
    async requestRedemption(input) {
        const reward = this.rewards.find((r) => r.id === input.rewardId && r.active);
        if (!reward)
            return null;
        const status = reward.requiresStaffApproval ? 'pending' : 'approved';
        const redemption = {
            id: (0, crypto_1.randomUUID)(),
            rewardId: reward.id,
            playerId: input.playerId,
            displayName: input.displayName,
            competitionId: input.competitionId ?? reward.competitionId,
            status,
            requestedAt: new Date().toISOString(),
            reviewedAt: status === 'approved' ? new Date().toISOString() : null,
            reviewedBy: status === 'approved' ? 'auto' : null,
            notes: null
        };
        this.redemptions.push(redemption);
        await this.save();
        await this.analyticsManager.trackEvent('reward_redemption_requested', 'game_activity', {
            redemptionId: redemption.id,
            rewardId: reward.id,
            status
        });
        return redemption;
    }
    async reviewRedemption(redemptionId, decision, reviewer, notes) {
        const idx = this.redemptions.findIndex((r) => r.id === redemptionId);
        if (idx < 0)
            return null;
        const current = this.redemptions[idx];
        this.redemptions[idx] = {
            ...current,
            status: decision,
            reviewedAt: new Date().toISOString(),
            reviewedBy: reviewer,
            notes: notes ?? current.notes
        };
        await this.save();
        await this.analyticsManager.trackEvent('reward_redemption_reviewed', 'game_activity', {
            redemptionId,
            decision
        });
        return this.redemptions[idx];
    }
}
exports.RewardManager = RewardManager;
