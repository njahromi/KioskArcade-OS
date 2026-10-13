import { AnalyticsManager } from './AnalyticsManager';
import { CompetitionManager } from './CompetitionManager';
import { CompetitionEngagementSummary } from './competition/types';

/**
 * Derives Phase 4 engagement metrics from AnalyticsManager events + local competition store.
 */
export class CompetitionEngagementService {
  constructor(
    private readonly analyticsManager: AnalyticsManager,
    private readonly competitionManager: CompetitionManager
  ) {}

  async getSummary(limitRecent = 20): Promise<CompetitionEngagementSummary> {
    const exported = await this.analyticsManager.exportAnalyticsData();
    const events: Array<{
      eventType: string;
      timestamp: Date | string;
      data: Record<string, unknown>;
    }> = Array.isArray(exported?.events) ? exported.events : [];

    const count = (type: string) => events.filter((e) => e.eventType === type).length;

    const names = new Set<string>();
    const byGame = new Map<string, number>();
    for (const s of this.competitionManager.getAllSubmissions()) {
      names.add(s.displayName.toLowerCase());
      byGame.set(s.gameId, (byGame.get(s.gameId) ?? 0) + 1);
    }

    const recentEvents = [...events]
      .sort((a, b) => {
        const ta = new Date(a.timestamp).getTime();
        const tb = new Date(b.timestamp).getTime();
        return tb - ta;
      })
      .slice(0, limitRecent)
      .map((e) => ({
        eventType: e.eventType,
        at: new Date(e.timestamp).toISOString(),
        data: e.data ?? {}
      }));

    return {
      competitionsCreated: count('competition_created'),
      competitionsEnded: count('competition_ended'),
      scoresSubmitted: count('competition_score_submitted'),
      scoresFlagged: this.competitionManager.getFlaggedSubmissions().length,
      scoresRejected: count('competition_score_rejected'),
      uniqueDisplayNames: names.size,
      playerProfilesCreated: count('player_profile_created'),
      playerIdentifications: count('player_identified'),
      rewardsCreated: count('reward_created'),
      redemptionsRequested: count('reward_redemption_requested'),
      redemptionsApproved: events.filter(
        (e) =>
          e.eventType === 'reward_redemption_reviewed' &&
          (e.data as { decision?: string })?.decision === 'approved'
      ).length,
      achievementsUnlocked: count('achievement_unlocked'),
      syncRuns: count('competition_sync_completed'),
      participationByGame: Array.from(byGame.entries())
        .map(([gameId, submissions]) => ({ gameId, submissions }))
        .sort((a, b) => b.submissions - a.submissions),
      recentEvents
    };
  }
}
