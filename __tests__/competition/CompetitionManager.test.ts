import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';
import { CompetitionManager } from '../../electron-app/services/CompetitionManager';
import { AnalyticsManager } from '../../electron-app/services/AnalyticsManager';

describe('CompetitionManager', () => {
  let tempDir: string;
  let cwdSpy: jest.SpyInstance;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'kiosk-comp-'));
    cwdSpy = jest.spyOn(process, 'cwd').mockReturnValue(tempDir);
  });

  afterEach(async () => {
    cwdSpy.mockRestore();
    await fs.remove(tempDir);
  });

  it('creates a competition and accepts a finalized score', async () => {
    const analytics = {
      trackEvent: jest.fn().mockResolvedValue(undefined)
    } as unknown as AnalyticsManager;

    const manager = new CompetitionManager(analytics);
    await manager.initialize();

    const competition = await manager.createCompetition({
      name: 'Test Cup',
      gameId: 'tetris'
    });
    expect(competition?.status).toBe('active');

    manager.setDisplayName('Ace');
    const session = manager.startGameSession('tetris');
    // Simulate a session that has been running long enough to pass anti-cheat timing.
    (session as { startedAt: string }).startedAt = new Date(Date.now() - 15_000).toISOString();

    const submission = await manager.handleScoreEvent({
      type: 'kioskarcade:score',
      gameId: 'tetris',
      score: 250,
      event: 'final',
      progress: { lines: 12 }
    });

    expect(submission?.score).toBe(250);
    expect(submission?.validation).toBe('accepted');
    expect(submission?.displayName).toBe('Ace');

    const board = manager.getLeaderboard(competition!.id);
    expect(board[0]?.displayName).toBe('Ace');
    expect(board[0]?.score).toBe(250);

    expect(analytics.trackEvent).toHaveBeenCalledWith(
      'competition_created',
      'game_activity',
      expect.any(Object)
    );
    expect(analytics.trackEvent).toHaveBeenCalledWith(
      'competition_score_submitted',
      'game_activity',
      expect.objectContaining({ score: 250 })
    );
  });
});
