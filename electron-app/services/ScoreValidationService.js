"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ScoreValidationService = void 0;
class ScoreValidationService {
    constructor() {
        this.finalizedSessions = new Set();
    }
    validate(sample, session, adapter, options = {}) {
        if (session.finalized || this.finalizedSessions.has(session.sessionId)) {
            return { status: 'rejected', reason: 'session_already_finalized' };
        }
        if (sample.gameId !== session.gameId) {
            return { status: 'rejected', reason: 'game_id_mismatch' };
        }
        if (!Number.isFinite(sample.score) || sample.score < 0) {
            return { status: 'rejected', reason: 'invalid_score' };
        }
        const startedAt = Date.parse(session.startedAt);
        const elapsed = Date.now() - startedAt;
        const minSessionMs = options.minSessionMs ?? 2000;
        if (sample.event === 'final' && elapsed < minSessionMs) {
            return { status: 'flagged', reason: 'session_too_short' };
        }
        if (adapter?.plausibleRange) {
            const { min, max } = adapter.plausibleRange;
            if (sample.score < min || sample.score > max) {
                return { status: 'flagged', reason: 'score_out_of_plausible_range' };
            }
        }
        // Sudden huge jumps without progress are suspicious for mock/HTML games.
        if (session.lastScore > 0 && sample.score > session.lastScore * 20 && sample.score > 10000) {
            return { status: 'flagged', reason: 'implausible_score_jump' };
        }
        return { status: 'accepted' };
    }
    markFinalized(sessionId) {
        this.finalizedSessions.add(sessionId);
    }
    clearSession(sessionId) {
        this.finalizedSessions.delete(sessionId);
    }
}
exports.ScoreValidationService = ScoreValidationService;
