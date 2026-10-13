import * as fs from 'fs-extra';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { Logger } from '../utils/Logger';
import { CompetitionManager } from './CompetitionManager';
import { PlayerProfileManager } from './PlayerProfileManager';
import { AnalyticsManager } from './AnalyticsManager';
import { Season, SeasonStanding, SeasonStatus } from './competition/types';

interface SeasonStore {
  seasons: Season[];
}

export class SeasonManager {
  private readonly logger: Logger;
  private readonly seasonsFile: string;
  private readonly competitionManager: CompetitionManager;
  private readonly profileManager: PlayerProfileManager;
  private readonly analyticsManager: AnalyticsManager;
  private seasons: Season[] = [];

  constructor(
    competitionManager: CompetitionManager,
    profileManager: PlayerProfileManager,
    analyticsManager: AnalyticsManager
  ) {
    this.logger = new Logger();
    this.competitionManager = competitionManager;
    this.profileManager = profileManager;
    this.analyticsManager = analyticsManager;
    this.seasonsFile = path.join(process.cwd(), 'data', 'competition-seasons.json');
  }

  async initialize(): Promise<void> {
    await fs.ensureDir(path.dirname(this.seasonsFile));
    if (await fs.pathExists(this.seasonsFile)) {
      const store = (await fs.readJson(this.seasonsFile)) as SeasonStore;
      this.seasons = Array.isArray(store.seasons) ? store.seasons : [];
    } else {
      this.seasons = [];
      await this.save();
    }
    await this.refreshStatuses();
    this.logger.info(`SeasonManager initialized (${this.seasons.length} seasons)`);
  }

  private async save(): Promise<void> {
    await fs.writeJson(this.seasonsFile, { seasons: this.seasons } satisfies SeasonStore, {
      spaces: 2
    });
  }

  private computeStatus(season: Season, now = Date.now()): SeasonStatus {
    if (season.status === 'ended') return 'ended';
    const start = Date.parse(season.startsAt);
    if (Number.isFinite(start) && start > now) return 'upcoming';
    if (season.endsAt) {
      const end = Date.parse(season.endsAt);
      if (Number.isFinite(end) && end < now) return 'ended';
    }
    return 'active';
  }

  async refreshStatuses(): Promise<void> {
    let changed = false;
    this.seasons = this.seasons.map((s) => {
      const next = this.computeStatus(s);
      if (next !== s.status) {
        changed = true;
        return { ...s, status: next };
      }
      return s;
    });
    if (changed) await this.save();
  }

  listSeasons(): Season[] {
    return [...this.seasons].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  getSeason(id: string): Season | null {
    return this.seasons.find((s) => s.id === id) ?? null;
  }

  getActiveSeason(): Season | null {
    return this.seasons.find((s) => this.computeStatus(s) === 'active') ?? null;
  }

  async createSeason(input: {
    readonly name: string;
    readonly description?: string;
    readonly startsAt?: string;
    readonly endsAt?: string | null;
  }): Promise<Season> {
    const draft: Season = {
      id: randomUUID(),
      name: input.name.trim() || 'Season',
      description: (input.description ?? '').trim(),
      status: 'upcoming',
      startsAt: input.startsAt ?? new Date().toISOString(),
      endsAt: input.endsAt ?? null,
      createdAt: new Date().toISOString()
    };
    const season: Season = { ...draft, status: this.computeStatus(draft) };
    this.seasons.push(season);
    await this.save();
    await this.analyticsManager.trackEvent('season_created', 'game_activity', {
      seasonId: season.id,
      name: season.name
    });
    return season;
  }

  async endSeason(seasonId: string): Promise<Season | null> {
    const idx = this.seasons.findIndex((s) => s.id === seasonId);
    if (idx < 0) return null;
    this.seasons[idx] = {
      ...this.seasons[idx],
      status: 'ended',
      endsAt: this.seasons[idx].endsAt ?? new Date().toISOString()
    };
    await this.save();
    const standings = this.getStandings(seasonId);
    for (const row of standings.slice(0, 50)) {
      if (row.playerId) {
        await this.profileManager.setSeasonalRank(row.playerId, row.rank);
      }
    }
    await this.analyticsManager.trackEvent('season_ended', 'game_activity', {
      seasonId,
      standings: standings.length
    });
    return this.seasons[idx];
  }

  /**
   * Points: 10 / 7 / 5 / 3 / 1 for ranks 1–5 in each competition tagged with this season.
   */
  getStandings(seasonId: string, limit = 25): SeasonStanding[] {
    const pointsForRank = (rank: number): number => {
      if (rank === 1) return 10;
      if (rank === 2) return 7;
      if (rank === 3) return 5;
      if (rank === 4) return 3;
      if (rank === 5) return 1;
      return 0;
    };

    const comps = this.competitionManager
      .listCompetitions()
      .filter((c) => c.seasonId === seasonId);

    const map = new Map<
      string,
      { playerId: string | null; displayName: string; points: number; played: number; best: number }
    >();

    for (const c of comps) {
      const board = this.competitionManager.getLeaderboard(c.id, 20);
      for (const entry of board) {
        const key = entry.playerId ?? `name:${entry.displayName.toLowerCase()}`;
        const existing = map.get(key) ?? {
          playerId: entry.playerId,
          displayName: entry.displayName,
          points: 0,
          played: 0,
          best: 0
        };
        existing.points += pointsForRank(entry.rank);
        existing.played += 1;
        existing.best = Math.max(existing.best, entry.score);
        if (entry.playerId) existing.playerId = entry.playerId;
        map.set(key, existing);
      }
    }

    return Array.from(map.values())
      .sort((a, b) => b.points - a.points || b.best - a.best)
      .slice(0, limit)
      .map((row, index) => ({
        rank: index + 1,
        playerId: row.playerId,
        displayName: row.displayName,
        points: row.points,
        competitionsPlayed: row.played,
        bestScore: row.best
      }));
  }
}
