import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';
import { CompetitionManager } from '../../electron-app/services/CompetitionManager';
import {
  CompetitionSyncService,
  FileHubTransport
} from '../../electron-app/services/CompetitionSyncService';
import { AnalyticsManager } from '../../electron-app/services/AnalyticsManager';
import { ConfigManager } from '../../electron-app/config/AppConfig';
import { ScoreSubmission } from '../../electron-app/services/competition/types';

describe('Phase 3 sync + merge', () => {
  let tempDir: string;
  let cwdSpy: jest.SpyInstance;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'kiosk-sync-'));
    cwdSpy = jest.spyOn(process, 'cwd').mockReturnValue(tempDir);
    ConfigManager.getInstance().setCompetitionSyncEnabled(true);
  });

  afterEach(async () => {
    ConfigManager.getInstance().setCompetitionSyncEnabled(false);
    cwdSpy.mockRestore();
    await fs.remove(tempDir);
  });

  it('merges remote scores with max-score-wins per player', async () => {
    const analytics = { trackEvent: jest.fn().mockResolvedValue(undefined) } as unknown as AnalyticsManager;
    const manager = new CompetitionManager(analytics);
    await manager.initialize();
    const competition = await manager.createCompetition({ name: 'Cup', gameId: 'tetris' });

    const low: ScoreSubmission = {
      id: 'a',
      competitionId: competition!.id,
      gameId: 'tetris',
      displayName: 'Nova',
      playerId: 'p1',
      score: 100,
      sessionId: 's1',
      submittedAt: new Date().toISOString(),
      source: 'adapter',
      validation: 'accepted',
      arcadeId: 'remote'
    };
    const high: ScoreSubmission = {
      ...low,
      id: 'b',
      score: 250,
      sessionId: 's2'
    };

    expect(await manager.mergeRemoteSubmission(low)).toBe('inserted');
    expect(await manager.mergeRemoteSubmission(high)).toBe('replaced');
    expect(await manager.mergeRemoteSubmission({ ...high, id: 'c', score: 50, sessionId: 's3' })).toBe(
      'skipped'
    );

    const board = manager.getLeaderboard(competition!.id);
    expect(board).toHaveLength(1);
    expect(board[0]!.score).toBe(250);
  });

  it('pushes and pulls across two cabinets via shared hub', async () => {
    const analytics = { trackEvent: jest.fn().mockResolvedValue(undefined) } as unknown as AnalyticsManager;
    const hub = path.join(tempDir, 'hub');

    const cabinetA = new CompetitionManager(analytics);
    await cabinetA.initialize();
    cabinetA.setIdentityContext('arcade-a', 'loc');
    const syncA = new CompetitionSyncService(cabinetA, new FileHubTransport(hub));
    syncA.setArcadeId('arcade-a');
    await syncA.initialize();
    syncA.stop();

    const cabinetB = new CompetitionManager(analytics);
    await cabinetB.initialize();
    cabinetB.setIdentityContext('arcade-b', 'loc');
    const syncB = new CompetitionSyncService(cabinetB, new FileHubTransport(hub));
    syncB.setArcadeId('arcade-b');
    await syncB.initialize();
    syncB.stop();

    const competition = await cabinetA.createCompetition({ name: 'Shared', gameId: 'snake' });
    syncA.enqueueCompetition(competition!);

    cabinetA.setDisplayName('Alpha');
    const session = cabinetA.startGameSession('snake');
    (session as { startedAt: string }).startedAt = new Date(Date.now() - 10_000).toISOString();
    const submission = await cabinetA.handleScoreEvent({
      type: 'kioskarcade:score',
      gameId: 'snake',
      score: 77,
      event: 'final'
    });
    expect(submission).not.toBeNull();
    syncA.enqueueScore(submission!);

    const push = await syncA.syncNow();
    expect(push.pushed).toBeGreaterThanOrEqual(1);

    const pull = await syncB.syncNow();
    expect(pull.pulled).toBeGreaterThanOrEqual(1);

    const remoteComp = cabinetB.getCompetition(competition!.id);
    expect(remoteComp?.name).toBe('Shared');
    const board = cabinetB.getLeaderboard(competition!.id);
    expect(board.some((e) => e.score === 77)).toBe(true);
  });
});
