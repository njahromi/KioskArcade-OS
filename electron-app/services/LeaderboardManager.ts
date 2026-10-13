import { CompetitionManager } from './CompetitionManager';
import { Competition, LeaderboardEntry } from './competition/types';

export type VenueLeaderboardEntry = LeaderboardEntry & {
  readonly competitionId: string;
  readonly competitionName: string;
  readonly gameId: string;
  readonly arcadeId: string | null;
};

/**
 * Ranking facade for Phase 3 venue-wide / idle cabinet displays.
 */
export class LeaderboardManager {
  constructor(private readonly competitionManager: CompetitionManager) {}

  getCompetitionLeaderboard(competitionId: string, limit = 20): LeaderboardEntry[] {
    return this.competitionManager.getLeaderboard(competitionId, limit);
  }

  getActiveLeaderboard(gameId?: string, limit = 20): {
    readonly competition: Competition | null;
    readonly entries: LeaderboardEntry[];
  } {
    const active = this.competitionManager.getActiveCompetition(gameId);
    if (!active) {
      return { competition: null, entries: [] };
    }
    return {
      competition: active,
      entries: this.competitionManager.getLeaderboard(active.id, limit)
    };
  }

  getVenueTopScores(limit = 10): VenueLeaderboardEntry[] {
    const comps = this.competitionManager.listCompetitions().filter((c) => c.status !== 'scheduled');
    const submissions = this.competitionManager.getAllSubmissions();
    const combined: VenueLeaderboardEntry[] = [];

    for (const c of comps) {
      for (const entry of this.competitionManager.getLeaderboard(c.id, limit)) {
        const raw = submissions.find((s) => s.id === entry.submissionId);
        combined.push({
          ...entry,
          competitionId: c.id,
          competitionName: c.name,
          gameId: c.gameId,
          arcadeId: raw?.arcadeId ?? null
        });
      }
    }

    // Dedupe by player identity across venue — keep best score
    const best = new Map<string, VenueLeaderboardEntry>();
    for (const entry of combined) {
      const key = entry.playerId ?? `name:${entry.displayName.toLowerCase()}:${entry.gameId}`;
      const existing = best.get(key);
      if (!existing || entry.score > existing.score) {
        best.set(key, entry);
      }
    }

    return Array.from(best.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map((entry, index) => ({ ...entry, rank: index + 1 }));
  }

  getActiveEventTimers(): Array<{
    readonly competitionId: string;
    readonly name: string;
    readonly gameId: string;
    readonly endsAt: string | null;
    readonly remainingMs: number | null;
    readonly topScore: number | null;
    readonly topPlayer: string | null;
  }> {
    const now = Date.now();
    return this.competitionManager
      .listCompetitions()
      .filter((c) => c.status === 'active')
      .map((c) => {
        const board = this.competitionManager.getLeaderboard(c.id, 1);
        const endsAtMs = c.endsAt ? Date.parse(c.endsAt) : null;
        return {
          competitionId: c.id,
          name: c.name,
          gameId: c.gameId,
          endsAt: c.endsAt,
          remainingMs:
            endsAtMs && Number.isFinite(endsAtMs) ? Math.max(0, endsAtMs - now) : null,
          topScore: board[0]?.score ?? null,
          topPlayer: board[0]?.displayName ?? null
        };
      });
  }
}
