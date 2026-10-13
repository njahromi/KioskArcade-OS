/** Shared competition contracts used across Phase 1–4 services. */

export type CompetitionMetric = 'high_score' | 'fastest_time';

export type CompetitionStatus = 'scheduled' | 'active' | 'ended';

export type ScoreValidationStatus = 'accepted' | 'flagged' | 'rejected';

export type ScoreEventKind = 'update' | 'final';

export interface ScoreProgress {
  readonly level?: number;
  readonly elapsedMs?: number;
  readonly completed?: boolean;
  readonly lines?: number;
  readonly length?: number;
}

export interface ScoreSample {
  readonly gameId: string;
  readonly score: number;
  readonly event: ScoreEventKind;
  readonly progress?: ScoreProgress | null;
  readonly reportedAt: string;
}

export interface GameCompetitionAdapter {
  readonly gameId: string;
  isSupported(): boolean;
  normalizeScoreEvent(raw: unknown): ScoreSample | null;
  readonly plausibleRange?: { readonly min: number; readonly max: number };
}

export interface Competition {
  readonly id: string;
  readonly name: string;
  readonly gameId: string;
  readonly metric: CompetitionMetric;
  readonly status: CompetitionStatus;
  readonly startsAt: string;
  readonly endsAt: string | null;
  readonly createdAt: string;
  /** Phase 3: optional venue-wide / seasonal marker */
  readonly seasonId?: string | null;
  readonly bracketEnabled?: boolean;
}

export interface ScoreSubmission {
  readonly id: string;
  readonly competitionId: string;
  readonly gameId: string;
  readonly displayName: string;
  readonly playerId: string | null;
  readonly score: number;
  readonly sessionId: string;
  readonly submittedAt: string;
  readonly source: 'adapter';
  readonly validation: ScoreValidationStatus;
  readonly arcadeId?: string;
  readonly locationId?: string;
  readonly progress?: ScoreProgress | null;
  readonly validationReason?: string;
}

export interface LeaderboardEntry {
  readonly rank: number;
  readonly displayName: string;
  readonly playerId: string | null;
  readonly score: number;
  readonly submittedAt: string;
  readonly validation: ScoreValidationStatus;
  readonly submissionId: string;
}

export interface ActiveGameSession {
  readonly sessionId: string;
  readonly gameId: string;
  readonly competitionId: string | null;
  readonly displayName: string;
  readonly playerId: string | null;
  readonly startedAt: string;
  lastScore: number;
  lastProgress: ScoreProgress | null;
  finalized: boolean;
}

export interface CreateCompetitionInput {
  readonly name: string;
  readonly gameId: string;
  readonly metric?: CompetitionMetric;
  readonly startsAt?: string;
  readonly endsAt?: string | null;
  readonly seasonId?: string | null;
  readonly bracketEnabled?: boolean;
}

export interface PlayerProfile {
  readonly id: string;
  readonly displayName: string;
  readonly pinHash: string | null;
  readonly qrPayload: string;
  readonly createdAt: string;
  readonly personalBests: Record<string, number>;
  readonly achievementIds: readonly string[];
  readonly tournamentHistory: readonly string[];
  readonly seasonalRank: number | null;
}

/** Safe profile shape for renderer / IPC (never includes pinHash). */
export interface PublicPlayerProfile {
  readonly id: string;
  readonly displayName: string;
  readonly hasPin: boolean;
  readonly qrPayload: string;
  readonly createdAt: string;
  readonly personalBests: Record<string, number>;
  readonly achievementIds: readonly string[];
  readonly tournamentHistory: readonly string[];
  readonly seasonalRank: number | null;
}

export interface AchievementProgress {
  readonly achievementId: string;
  readonly name: string;
  readonly description: string;
  readonly gameId: string | '*';
  readonly unlocked: boolean;
  readonly unlockedAt: string | null;
  /** 0–1 progress estimate from personal bests / last known values */
  readonly progress: number;
  readonly currentValue: number;
  readonly targetValue: number;
}

export interface AchievementDefinition {
  readonly id: string;
  readonly gameId: string | '*';
  readonly name: string;
  readonly description: string;
  readonly rule:
    | { readonly type: 'score_at_least'; readonly value: number }
    | { readonly type: 'progress_field_at_least'; readonly field: keyof ScoreProgress; readonly value: number };
}

export interface AchievementUnlock {
  readonly achievementId: string;
  readonly playerId: string;
  readonly unlockedAt: string;
  readonly competitionId: string | null;
}

export type RewardType = 'badge' | 'free_play' | 'coupon' | 'prize';

export interface RewardDefinition {
  readonly id: string;
  readonly name: string;
  readonly type: RewardType;
  readonly description: string;
  readonly requiresStaffApproval: boolean;
  readonly competitionId: string | null;
  readonly active: boolean;
  readonly createdAt: string;
}

export type RedemptionStatus = 'pending' | 'approved' | 'rejected' | 'fulfilled';

export interface RewardRedemption {
  readonly id: string;
  readonly rewardId: string;
  readonly playerId: string | null;
  readonly displayName: string;
  readonly competitionId: string | null;
  readonly status: RedemptionStatus;
  readonly requestedAt: string;
  readonly reviewedAt: string | null;
  readonly reviewedBy: string | null;
  readonly notes: string | null;
}

export interface SyncQueueItem {
  readonly id: string;
  readonly kind: 'score' | 'competition' | 'profile' | 'redemption';
  readonly payload: unknown;
  readonly createdAt: string;
  readonly attempts: number;
  readonly lastError: string | null;
}

export interface CompetitionTransport {
  push(items: readonly SyncQueueItem[]): Promise<{ readonly accepted: readonly string[]; readonly failed: readonly { id: string; error: string }[] }>;
  pull(since: string | null): Promise<{ readonly items: readonly SyncQueueItem[]; readonly cursor: string }>;
}
