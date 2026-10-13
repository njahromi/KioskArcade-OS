import {
  ActiveGameSession,
  GameCompetitionAdapter,
  ScoreSample,
  ScoreValidationStatus
} from './competition/types';

export interface ValidationResult {
  readonly status: ScoreValidationStatus;
  readonly reason?: string;
}

export class ScoreValidationService {
  private readonly finalizedSessions = new Set<string>();

  validate(
    sample: ScoreSample,
    session: ActiveGameSession,
    adapter: GameCompetitionAdapter | null,
    options: { readonly minSessionMs?: number } = {}
  ): ValidationResult {
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
    const minSessionMs = options.minSessionMs ?? 2_000;
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
    if (session.lastScore > 0 && sample.score > session.lastScore * 20 && sample.score > 10_000) {
      return { status: 'flagged', reason: 'implausible_score_jump' };
    }

    return { status: 'accepted' };
  }

  markFinalized(sessionId: string): void {
    this.finalizedSessions.add(sessionId);
  }

  clearSession(sessionId: string): void {
    this.finalizedSessions.delete(sessionId);
  }
}
