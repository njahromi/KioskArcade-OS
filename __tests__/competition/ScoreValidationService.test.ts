import { ScoreValidationService } from '../../electron-app/services/ScoreValidationService';
import { ActiveGameSession, GameCompetitionAdapter, ScoreSample } from '../../electron-app/services/competition/types';

function makeSession(overrides: Partial<ActiveGameSession> = {}): ActiveGameSession {
  return {
    sessionId: 'sess-1',
    gameId: 'tetris',
    competitionId: 'comp-1',
    displayName: 'Tester',
    playerId: null,
    startedAt: new Date(Date.now() - 10_000).toISOString(),
    lastScore: 10,
    lastProgress: null,
    finalized: false,
    ...overrides
  };
}

function makeSample(overrides: Partial<ScoreSample> = {}): ScoreSample {
  return {
    gameId: 'tetris',
    score: 100,
    event: 'final',
    progress: null,
    reportedAt: new Date().toISOString(),
    ...overrides
  };
}

const adapter: GameCompetitionAdapter = {
  gameId: 'tetris',
  isSupported: () => true,
  normalizeScoreEvent: () => null,
  plausibleRange: { min: 0, max: 999_999 }
};

describe('ScoreValidationService', () => {
  it('accepts a normal final score', () => {
    const service = new ScoreValidationService();
    const result = service.validate(makeSample(), makeSession(), adapter);
    expect(result.status).toBe('accepted');
  });

  it('rejects already finalized sessions', () => {
    const service = new ScoreValidationService();
    const result = service.validate(makeSample(), makeSession({ finalized: true }), adapter);
    expect(result.status).toBe('rejected');
  });

  it('flags scores outside plausible range', () => {
    const service = new ScoreValidationService();
    const result = service.validate(makeSample({ score: 2_000_000 }), makeSession(), adapter);
    expect(result.status).toBe('flagged');
    expect(result.reason).toBe('score_out_of_plausible_range');
  });

  it('flags very short sessions on final', () => {
    const service = new ScoreValidationService();
    const result = service.validate(
      makeSample(),
      makeSession({ startedAt: new Date().toISOString() }),
      adapter
    );
    expect(result.status).toBe('flagged');
    expect(result.reason).toBe('session_too_short');
  });
});
