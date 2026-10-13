import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';
import { PlayerProfileManager } from '../../electron-app/services/PlayerProfileManager';
import { AchievementManager } from '../../electron-app/services/AchievementManager';
import { ScoreSubmission } from '../../electron-app/services/competition/types';

describe('AchievementManager', () => {
  let tempDir: string;
  let cwdSpy: jest.SpyInstance;
  let profiles: PlayerProfileManager;
  let achievements: AchievementManager;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'kiosk-ach-'));
    cwdSpy = jest.spyOn(process, 'cwd').mockReturnValue(tempDir);
    profiles = new PlayerProfileManager();
    await profiles.initialize();
    achievements = new AchievementManager(profiles);
    await achievements.initialize();
  });

  afterEach(async () => {
    cwdSpy.mockRestore();
    await fs.remove(tempDir);
  });

  it('unlocks score-based achievements for identified players', async () => {
    const player = await profiles.createProfile('Riley');
    const submission: ScoreSubmission = {
      id: 'sub-1',
      competitionId: 'comp-1',
      gameId: 'tetris',
      displayName: 'Riley',
      playerId: player.id,
      score: 120,
      sessionId: 'sess-1',
      submittedAt: new Date().toISOString(),
      source: 'adapter',
      validation: 'accepted',
      progress: { lines: 8 }
    };

    const unlocked = await achievements.evaluateSubmission(submission);
    expect(unlocked.some((u) => u.achievementId === 'tetris_100')).toBe(true);

    const progress = achievements.getProgressForPlayer(player.id, { tetris: 120 });
    const lineClearer = progress.find((p) => p.achievementId === 'tetris_100');
    expect(lineClearer?.unlocked).toBe(true);
    expect(lineClearer?.progress).toBe(1);
  });

  it('skips anonymous submissions', async () => {
    const submission: ScoreSubmission = {
      id: 'sub-2',
      competitionId: 'comp-1',
      gameId: 'snake',
      displayName: 'Guest',
      playerId: null,
      score: 999,
      sessionId: 'sess-2',
      submittedAt: new Date().toISOString(),
      source: 'adapter',
      validation: 'accepted',
      progress: null
    };
    const unlocked = await achievements.evaluateSubmission(submission);
    expect(unlocked).toEqual([]);
  });
});
