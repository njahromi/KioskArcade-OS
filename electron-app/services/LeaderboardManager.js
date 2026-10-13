"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LeaderboardManager = void 0;
/**
 * Ranking facade for Phase 3 venue-wide / idle cabinet displays.
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
            return { competition: null, entries: [] };
        }
        return {
            competition: active,
            entries: this.competitionManager.getLeaderboard(active.id, limit)
        };
    }
    getVenueTopScores(limit = 10) {
        const comps = this.competitionManager.listCompetitions().filter((c) => c.status !== 'scheduled');
        const submissions = this.competitionManager.getAllSubmissions();
        const combined = [];
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
        const best = new Map();
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
    getActiveEventTimers() {
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
                remainingMs: endsAtMs && Number.isFinite(endsAtMs) ? Math.max(0, endsAtMs - now) : null,
                topScore: board[0]?.score ?? null,
                topPlayer: board[0]?.displayName ?? null
            };
        });
    }
}
exports.LeaderboardManager = LeaderboardManager;
