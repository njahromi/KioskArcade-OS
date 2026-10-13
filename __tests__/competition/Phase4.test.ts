import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';
import { CompetitionManager } from '../../electron-app/services/CompetitionManager';
import { RewardManager } from '../../electron-app/services/RewardManager';
import { SeasonManager } from '../../electron-app/services/SeasonManager';
import { BracketManager } from '../../electron-app/services/BracketManager';
import { PlayerProfileManager } from '../../electron-app/services/PlayerProfileManager';
import { AnalyticsManager } from '../../electron-app/services/AnalyticsManager';
import { ScoreValidationService } from '../../electron-app/services/ScoreValidationService';
import { GameAdapterManager } from '../../electron-app/services/GameAdapterManager';
import { ActiveGameSession } from '../../electron-app/services/competition/types';

describe('Phase 4 rewards, seasons, brackets', () => {
  let tempDir: string;
  let cwdSpy: jest.SpyInstance;
  let analytics: AnalyticsManager;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'kiosk-p4-'));
    cwdSpy = jest.spyOn(process, 'cwd').mockReturnValue(tempDir);
    analytics = {
      trackEvent: jest.fn().mockResolvedValue(undefined)
    } as unknown as AnalyticsManager;
  });

  afterEach(async () => {
    cwdSpy.mockRestore();
    await fs.remove(tempDir);
  });

  it('auto-grants top-N rewards when a competition ends', async () => {
    const competitions = new CompetitionManager(analytics);
    await competitions.initialize();
    const rewards = new RewardManager(analytics);
    rewards.setCompetitionManager(competitions);
    await rewards.initialize();

    const competition = await competitions.createCompetition({
      name: 'Finale',
      gameId: 'tetris',
      bracketEnabled: true
    });

    competitions.setDisplayName('Champ');
    const session = competitions.startGameSession('tetris');
    (session as { startedAt: string }).startedAt = new Date(Date.now() - 10_000).toISOString();
    await competitions.handleScoreEvent({
      type: 'kioskarcade:score',
      gameId: 'tetris',
      score: 500,
      event: 'final',
      progress: { lines: 20 }
    });

    await competitions.endCompetition(competition!.id);
    const granted = await rewards.grantForCompetitionEnd(competition!.id);
    expect(granted.length).toBeGreaterThan(0);
    expect(rewards.listRedemptions().length).toBeGreaterThan(0);
  });

  it('builds an elimination bracket with a champion', async () => {
    const competitions = new CompetitionManager(analytics);
    await competitions.initialize();
    const brackets = new BracketManager(competitions, analytics);
    await brackets.initialize();

    const competition = await competitions.createCompetition({
      name: 'Bracket Cup',
      gameId: 'snake'
    });

    for (const [name, score] of [
      ['A', 100],
      ['B', 90],
      ['C', 80],
      ['D', 70]
    ] as const) {
      competitions.setDisplayName(name);
      const session = competitions.startGameSession('snake');
      (session as { startedAt: string }).startedAt = new Date(Date.now() - 10_000).toISOString();
      await competitions.handleScoreEvent({
        type: 'kioskarcade:score',
        gameId: 'snake',
        score,
        event: 'final',
        progress: { length: 10 }
      });
      competitions.clearActiveSession();
    }

    const bracket = await brackets.createFromCompetition(competition!.id, { size: 4 });
    expect(bracket).not.toBeNull();
    expect(bracket!.championName).toBe('A');
    expect(bracket!.matches.length).toBeGreaterThan(0);
  });

  it('computes season standings from tagged competitions', async () => {
    const competitions = new CompetitionManager(analytics);
    await competitions.initialize();
    const profiles = new PlayerProfileManager();
    await profiles.initialize();
    const seasons = new SeasonManager(competitions, profiles, analytics);
    await seasons.initialize();

    const season = await seasons.createSeason({ name: 'Winter' });
    const competition = await competitions.createCompetition({
      name: 'Week 1',
      gameId: 'pong',
      seasonId: season.id
    });

    competitions.setDisplayName('Riley');
    const session = competitions.startGameSession('pong');
    (session as { startedAt: string }).startedAt = new Date(Date.now() - 10_000).toISOString();
    await competitions.handleScoreEvent({
      type: 'kioskarcade:score',
      gameId: 'pong',
      score: 40,
      event: 'final'
    });

    const standings = seasons.getStandings(season.id);
    expect(standings[0]?.displayName).toBe('Riley');
    expect(standings[0]?.points).toBe(10);
    expect(competition?.seasonId).toBe(season.id);
  });

  it('flags implausible tetris score vs lines', () => {
    const validation = new ScoreValidationService();
    const adapters = new GameAdapterManager();
    const session: ActiveGameSession = {
      sessionId: 's',
      gameId: 'tetris',
      competitionId: 'c',
      displayName: 'X',
      playerId: null,
      startedAt: new Date(Date.now() - 30_000).toISOString(),
      lastScore: 10,
      lastProgress: null,
      finalized: false
    };
    const result = validation.validate(
      {
        gameId: 'tetris',
        score: 50_000,
        event: 'final',
        progress: { lines: 2, elapsedMs: 20_000 },
        reportedAt: new Date().toISOString()
      },
      session,
      adapters.getAdapter('tetris')
    );
    expect(result.status).toBe('flagged');
  });
});
