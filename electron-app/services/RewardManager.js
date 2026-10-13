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
        this.competitionManager = null;
        this.logger = new Logger_1.Logger();
        this.analyticsManager = analyticsManager;
        this.storeFile = path.join(process.cwd(), 'data', 'competition-rewards.json');
    }
    setCompetitionManager(manager) {
        this.competitionManager = manager;
    }
    async initialize() {
        await fs.ensureDir(path.dirname(this.storeFile));
        if (await fs.pathExists(this.storeFile)) {
            const store = (await fs.readJson(this.storeFile));
            this.rewards = Array.isArray(store.rewards)
                ? store.rewards.map((r) => ({
                    ...r,
                    seasonId: r.seasonId ?? null,
                    autoGrantTopN: r.autoGrantTopN ?? null
                }))
                : [];
            this.redemptions = Array.isArray(store.redemptions) ? store.redemptions : [];
        }
        else {
            this.rewards = [];
            this.redemptions = [];
            await this.seedDefaults();
        }
        this.logger.info(`RewardManager initialized (${this.rewards.length} rewards, ${this.redemptions.length} redemptions)`);
    }
    async seedDefaults() {
        this.rewards = [
            {
                id: (0, crypto_1.randomUUID)(),
                name: 'Champion Badge',
                type: 'badge',
                description: 'Awarded to the #1 finisher of an event',
                requiresStaffApproval: false,
                competitionId: null,
                seasonId: null,
                autoGrantTopN: 1,
                active: true,
                createdAt: new Date().toISOString()
            },
            {
                id: (0, crypto_1.randomUUID)(),
                name: 'Free Play Credit',
                type: 'free_play',
                description: 'One complimentary play — staff must approve',
                requiresStaffApproval: true,
                competitionId: null,
                seasonId: null,
                autoGrantTopN: 3,
                active: true,
                createdAt: new Date().toISOString()
            },
            {
                id: (0, crypto_1.randomUUID)(),
                name: 'Venue Coupon',
                type: 'coupon',
                description: 'Snack or merch coupon — staff fulfillment required',
                requiresStaffApproval: true,
                competitionId: null,
                seasonId: null,
                autoGrantTopN: null,
                active: true,
                createdAt: new Date().toISOString()
            }
        ];
        await this.save();
    }
    async save() {
        const store = { rewards: this.rewards, redemptions: this.redemptions };
        await fs.writeJson(this.storeFile, store, { spaces: 2 });
    }
    listRewards(activeOnly = false) {
        return this.rewards.filter((r) => !activeOnly || r.active);
    }
    getReward(id) {
        return this.rewards.find((r) => r.id === id) ?? null;
    }
    listRedemptions(status) {
        const list = status
            ? this.redemptions.filter((r) => r.status === status)
            : [...this.redemptions];
        return list.sort((a, b) => b.requestedAt.localeCompare(a.requestedAt));
    }
    listRedemptionsForPlayer(playerId, displayName) {
        return this.redemptions
            .filter((r) => (playerId && r.playerId === playerId) ||
            (!!displayName && r.displayName.toLowerCase() === displayName.toLowerCase()))
            .sort((a, b) => b.requestedAt.localeCompare(a.requestedAt));
    }
    async createReward(input) {
        const reward = {
            id: (0, crypto_1.randomUUID)(),
            name: input.name.trim(),
            type: input.type,
            description: input.description.trim(),
            requiresStaffApproval: input.type === 'prize' || input.type === 'coupon' ? true : input.requiresStaffApproval,
            competitionId: input.competitionId ?? null,
            seasonId: input.seasonId ?? null,
            autoGrantTopN: input.autoGrantTopN ?? null,
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
    async setRewardActive(rewardId, active) {
        const idx = this.rewards.findIndex((r) => r.id === rewardId);
        if (idx < 0)
            return null;
        this.rewards[idx] = { ...this.rewards[idx], active };
        await this.save();
        return this.rewards[idx];
    }
    async requestRedemption(input) {
        const reward = this.rewards.find((r) => r.id === input.rewardId && r.active);
        if (!reward)
            return null;
        // Block duplicate open claims for same reward + identity
        const open = this.redemptions.some((r) => r.rewardId === reward.id &&
            (r.status === 'pending' || r.status === 'approved') &&
            ((input.playerId && r.playerId === input.playerId) ||
                r.displayName.toLowerCase() === input.displayName.toLowerCase()));
        if (open) {
            this.logger.warn(`Duplicate redemption blocked for ${reward.id} / ${input.displayName}`);
            return null;
        }
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
            status,
            type: reward.type
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
    /** When a competition ends, auto-offer configured rewards to top-N finishers. */
    async grantForCompetitionEnd(competitionId) {
        if (!this.competitionManager)
            return [];
        const competition = this.competitionManager.getCompetition(competitionId);
        if (!competition)
            return [];
        const board = this.competitionManager.getLeaderboard(competitionId, 10);
        const granted = [];
        for (const reward of this.rewards.filter((r) => r.active && r.autoGrantTopN)) {
            if (reward.competitionId && reward.competitionId !== competitionId)
                continue;
            if (reward.seasonId && reward.seasonId !== competition.seasonId)
                continue;
            const topN = reward.autoGrantTopN ?? 0;
            for (const entry of board.filter((e) => e.rank <= topN)) {
                const redemption = await this.requestRedemption({
                    rewardId: reward.id,
                    playerId: entry.playerId,
                    displayName: entry.displayName,
                    competitionId
                });
                if (redemption)
                    granted.push(redemption);
            }
        }
        if (granted.length > 0) {
            await this.analyticsManager.trackEvent('rewards_auto_granted', 'game_activity', {
                competitionId,
                count: granted.length
            });
        }
        return granted;
    }
    getAuditTrail(limit = 50) {
        return this.listRedemptions()
            .slice(0, limit)
            .map((r) => {
            const reward = this.getReward(r.rewardId);
            return {
                ...r,
                rewardName: reward?.name ?? r.rewardId,
                rewardType: reward?.type ?? null
            };
        });
    }
}
exports.RewardManager = RewardManager;
