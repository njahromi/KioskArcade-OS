import * as fs from 'fs-extra';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { Logger } from '../utils/Logger';
import { AnalyticsManager } from './AnalyticsManager';
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

  constructor(analyticsManager: AnalyticsManager) {
    this.logger = new Logger();
    this.analyticsManager = analyticsManager;
    this.storeFile = path.join(process.cwd(), 'data', 'competition-rewards.json');
  }

  async initialize(): Promise<void> {
    await fs.ensureDir(path.dirname(this.storeFile));
    if (await fs.pathExists(this.storeFile)) {
      const store = (await fs.readJson(this.storeFile)) as RewardStore;
      this.rewards = Array.isArray(store.rewards) ? store.rewards : [];
      this.redemptions = Array.isArray(store.redemptions) ? store.redemptions : [];
    } else {
      this.rewards = [];
      this.redemptions = [];
      await this.save();
    }
    this.logger.info(
      `RewardManager initialized (${this.rewards.length} rewards, ${this.redemptions.length} redemptions)`
    );
  }

  private async save(): Promise<void> {
    const store: RewardStore = { rewards: this.rewards, redemptions: this.redemptions };
    await fs.writeJson(this.storeFile, store, { spaces: 2 });
  }

  listRewards(activeOnly = false): RewardDefinition[] {
    return this.rewards.filter((r) => !activeOnly || r.active);
  }

  listRedemptions(status?: RedemptionStatus): RewardRedemption[] {
    if (!status) return [...this.redemptions];
    return this.redemptions.filter((r) => r.status === status);
  }

  async createReward(input: {
    readonly name: string;
    readonly type: RewardType;
    readonly description: string;
    readonly requiresStaffApproval: boolean;
    readonly competitionId?: string | null;
  }): Promise<RewardDefinition> {
    const reward: RewardDefinition = {
      id: randomUUID(),
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

  async requestRedemption(input: {
    readonly rewardId: string;
    readonly playerId: string | null;
    readonly displayName: string;
    readonly competitionId?: string | null;
  }): Promise<RewardRedemption | null> {
    const reward = this.rewards.find((r) => r.id === input.rewardId && r.active);
    if (!reward) return null;

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
      status
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
}
