import { CompetitionManager } from './CompetitionManager';
import { LeaderboardEntry } from './competition/types';

/**
 * Thin ranking facade extracted for Phase 3+ venue-wide views.
 * Phase 1 ranking still lives on CompetitionManager; this aggregates across competitions.
 */
export class LeaderboardManager {
  constructor(private readonly competitionManager: CompetitionManager) {}

  getCompetitionLeaderboard(competitionId: string, limit = 20): LeaderboardEntry[] {
    return this.competitionManager.getLeaderboard(competitionId, limit);
  }

  getActiveLeaderboard(gameId?: string, limit = 20): {
    readonly competitionId: string | null;
    readonly entries: LeaderboardEntry[];
  } {
    const active = this.competitionManager.getActiveCompetition(gameId);
    if (!active) {
      return { competitionId: null, entries: [] };
    }
    return {
      competitionId: active.id,
      entries: this.competitionManager.getLeaderboard(active.id, limit)
    };
  }

  getVenueTopScores(limit = 10): Array<LeaderboardEntry & { readonly competitionId: string; readonly gameId: string }> {
    const comps = this.competitionManager.listCompetitions().filter((c) => c.status !== 'scheduled');
    const combined: Array<LeaderboardEntry & { competitionId: string; gameId: string }> = [];

    for (const c of comps) {
      for (const entry of this.competitionManager.getLeaderboard(c.id, limit)) {
        combined.push({ ...entry, competitionId: c.id, gameId: c.gameId });
      }
    }

    return combined
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map((entry, index) => ({ ...entry, rank: index + 1 }));
  }
}
