import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';
import { CompetitionManager } from '../../electron-app/services/CompetitionManager';
import { TournamentScheduler } from '../../electron-app/services/TournamentScheduler';
import { AnalyticsManager } from '../../electron-app/services/AnalyticsManager';

describe('TournamentScheduler', () => {
  let tempDir: string;
  let cwdSpy: jest.SpyInstance;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'kiosk-sched-'));
    cwdSpy = jest.spyOn(process, 'cwd').mockReturnValue(tempDir);
  });

  afterEach(async () => {
    cwdSpy.mockRestore();
    await fs.remove(tempDir);
  });

  it('spawns a due daily schedule and lists upcoming events', async () => {
    const analytics = { trackEvent: jest.fn().mockResolvedValue(undefined) } as unknown as AnalyticsManager;
    const competitions = new CompetitionManager(analytics);
    await competitions.initialize();
    const scheduler = new TournamentScheduler(competitions);
    await scheduler.initialize();
    scheduler.stop();

    const now = new Date();
    const startTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    await scheduler.upsertSchedule({
      id: 'sched-1',
      name: 'Lunch Rush',
      gameId: 'pong',
      cadence: 'daily',
      startTime,
      durationMinutes: 30,
      enabled: true,
      seasonId: null,
      bracketEnabled: false,
      weeklyDay: 1,
      lastSpawnedDate: null
    });

    const spawned = await scheduler.tick();
    expect(spawned.length).toBe(1);
    const first = spawned[0]!;
    expect(first.name).toBe('Lunch Rush');
    expect(competitions.getActiveCompetition('pong')?.id).toBe(first.id);

    // Second tick same day should not duplicate
    const again = await scheduler.tick();
    expect(again.length).toBe(0);

    const upcoming = scheduler.getUpcomingEvents();
    expect(upcoming.some((e) => e.scheduleId === 'sched-1')).toBe(true);
  });
});
