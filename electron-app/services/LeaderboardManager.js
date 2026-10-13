"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LeaderboardManager = void 0;
/**
 * Thin ranking facade extracted for Phase 3+ venue-wide views.
 * Phase 1 ranking still lives on CompetitionManager; this aggregates across competitions.
 */
class LeaderboardManager {
    constructor(competitionManager) {
        this.competitionManager = competitionManager;
    }
    getCompetitionLeaderboard(competitionId, limit = 20) {
        return this.competitionManager.getLeaderboard(competitionId, limit);
    }
    getActiveLeaderboard(gameId, limit = 20) {
        const active = this.competitionManager.getActiveCompetition(gameId);
        if (!active) {
            return { competitionId: null, entries: [] };
        }
        return {
            competitionId: active.id,
            entries: this.competitionManager.getLeaderboard(active.id, limit)
        };
    }
    getVenueTopScores(limit = 10) {
        const comps = this.competitionManager.listCompetitions().filter((c) => c.status !== 'scheduled');
        const combined = [];
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
exports.LeaderboardManager = LeaderboardManager;
