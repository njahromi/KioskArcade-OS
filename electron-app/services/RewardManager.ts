import * as fs from 'fs-extra';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { Logger } from '../utils/Logger';
import { AnalyticsManager } from './AnalyticsManager';
import { CompetitionManager } from './CompetitionManager';
import {
  RedemptionStatus,
  RewardDefinition,
  RewardRedemption,
  RewardType
} from './competition/types';

interface RewardStore {
  rewards: RewardDefinition[];
  redemptions: RewardRedemption[];
}

export class RewardManager {
  private readonly logger: Logger;
  private readonly analyticsManager: AnalyticsManager;
  private readonly storeFile: string;
  private rewards: RewardDefinition[] = [];
  private redemptions: RewardRedemption[] = [];
  private competitionManager: CompetitionManager | null = null;

  constructor(analyticsManager: AnalyticsManager) {
    this.logger = new Logger();
    this.analyticsManager = analyticsManager;
    this.storeFile = path.join(process.cwd(), 'data', 'competition-rewards.json');
  }

  setCompetitionManager(manager: CompetitionManager): void {
    this.competitionManager = manager;
  }

  async initialize(): Promise<void> {
    await fs.ensureDir(path.dirname(this.storeFile));
    if (await fs.pathExists(this.storeFile)) {
      const store = (await fs.readJson(this.storeFile)) as RewardStore;
      this.rewards = Array.isArray(store.rewards)
        ? store.rewards.map((r) => ({
            ...r,
            seasonId: r.seasonId ?? null,
            autoGrantTopN: r.autoGrantTopN ?? null
          }))
        : [];
      this.redemptions = Array.isArray(store.redemptions) ? store.redemptions : [];
    } else {
      this.rewards = [];
      this.redemptions = [];
      await this.seedDefaults();
    }
    this.logger.info(
      `RewardManager initialized (${this.rewards.length} rewards, ${this.redemptions.length} redemptions)`
    );
  }

  private async seedDefaults(): Promise<void> {
    this.rewards = [
      {
        id: randomUUID(),
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
        id: randomUUID(),
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
        id: randomUUID(),
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

  private async save(): Promise<void> {
    const store: RewardStore = { rewards: this.rewards, redemptions: this.redemptions };
    await fs.writeJson(this.storeFile, store, { spaces: 2 });
  }

  listRewards(activeOnly = false): RewardDefinition[] {
    return this.rewards.filter((r) => !activeOnly || r.active);
  }

  getReward(id: string): RewardDefinition | null {
    return this.rewards.find((r) => r.id === id) ?? null;
  }

  listRedemptions(status?: RedemptionStatus): RewardRedemption[] {
    const list = status
      ? this.redemptions.filter((r) => r.status === status)
      : [...this.redemptions];
    return list.sort((a, b) => b.requestedAt.localeCompare(a.requestedAt));
  }

  listRedemptionsForPlayer(playerId: string | null, displayName?: string): RewardRedemption[] {
    return this.redemptions
      .filter(
        (r) =>
          (playerId && r.playerId === playerId) ||
          (!!displayName && r.displayName.toLowerCase() === displayName.toLowerCase())
      )
      .sort((a, b) => b.requestedAt.localeCompare(a.requestedAt));
  }

  async createReward(input: {
    readonly name: string;
    readonly type: RewardType;
    readonly description: string;
    readonly requiresStaffApproval: boolean;
    readonly competitionId?: string | null;
    readonly seasonId?: string | null;
    readonly autoGrantTopN?: number | null;
  }): Promise<RewardDefinition> {
    const reward: RewardDefinition = {
      id: randomUUID(),
      name: input.name.trim(),
      type: input.type,
      description: input.description.trim(),
      requiresStaffApproval:
        input.type === 'prize' || input.type === 'coupon' ? true : input.requiresStaffApproval,
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

  async setRewardActive(rewardId: string, active: boolean): Promise<RewardDefinition | null> {
    const idx = this.rewards.findIndex((r) => r.id === rewardId);
    if (idx < 0) return null;
    this.rewards[idx] = { ...this.rewards[idx], active };
    await this.save();
    return this.rewards[idx];
  }

  async requestRedemption(input: {
    readonly rewardId: string;
    readonly playerId: string | null;
    readonly displayName: string;
    readonly competitionId?: string | null;
  }): Promise<RewardRedemption | null> {
    const reward = this.rewards.find((r) => r.id === input.rewardId && r.active);
    if (!reward) return null;

    // Block duplicate open claims for same reward + identity
    const open = this.redemptions.some(
      (r) =>
        r.rewardId === reward.id &&
        (r.status === 'pending' || r.status === 'approved') &&
        ((input.playerId && r.playerId === input.playerId) ||
          r.displayName.toLowerCase() === input.displayName.toLowerCase())
    );
    if (open) {
      this.logger.warn(`Duplicate redemption blocked for ${reward.id} / ${input.displayName}`);
      return null;
    }

    const status: RedemptionStatus = reward.requiresStaffApproval ? 'pending' : 'approved';
    const redemption: RewardRedemption = {
      id: randomUUID(),
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

  async reviewRedemption(
    redemptionId: string,
    decision: 'approved' | 'rejected' | 'fulfilled',
    reviewer: string,
    notes?: string
  ): Promise<RewardRedemption | null> {
    const idx = this.redemptions.findIndex((r) => r.id === redemptionId);
    if (idx < 0) return null;
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
  async grantForCompetitionEnd(competitionId: string): Promise<RewardRedemption[]> {
    if (!this.competitionManager) return [];
    const competition = this.competitionManager.getCompetition(competitionId);
    if (!competition) return [];

    const board = this.competitionManager.getLeaderboard(competitionId, 10);
    const granted: RewardRedemption[] = [];

    for (const reward of this.rewards.filter((r) => r.active && r.autoGrantTopN)) {
      if (reward.competitionId && reward.competitionId !== competitionId) continue;
      if (reward.seasonId && reward.seasonId !== competition.seasonId) continue;
      const topN = reward.autoGrantTopN ?? 0;
      for (const entry of board.filter((e) => e.rank <= topN)) {
        const redemption = await this.requestRedemption({
          rewardId: reward.id,
          playerId: entry.playerId,
          displayName: entry.displayName,
          competitionId
        });
        if (redemption) granted.push(redemption);
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

  getAuditTrail(limit = 50): Array<RewardRedemption & { rewardName: string; rewardType: RewardType | null }> {
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
