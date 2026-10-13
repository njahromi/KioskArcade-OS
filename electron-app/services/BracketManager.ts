import * as fs from 'fs-extra';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { Logger } from '../utils/Logger';
import { CompetitionManager } from './CompetitionManager';
import { AnalyticsManager } from './AnalyticsManager';
import { BracketMatch, EliminationBracket, LeaderboardEntry } from './competition/types';

interface BracketStore {
  brackets: EliminationBracket[];
}

function nextPowerOfTwo(n: number): number {
  let p = 1;
  while (p < n) p *= 2;
  return Math.max(2, p);
}

export class BracketManager {
  private readonly logger: Logger;
  private readonly bracketsFile: string;
  private readonly competitionManager: CompetitionManager;
  private readonly analyticsManager: AnalyticsManager;
  private brackets: EliminationBracket[] = [];

  constructor(competitionManager: CompetitionManager, analyticsManager: AnalyticsManager) {
    this.logger = new Logger();
    this.competitionManager = competitionManager;
    this.analyticsManager = analyticsManager;
    this.bracketsFile = path.join(process.cwd(), 'data', 'competition-brackets.json');
  }

  async initialize(): Promise<void> {
    await fs.ensureDir(path.dirname(this.bracketsFile));
    if (await fs.pathExists(this.bracketsFile)) {
      const store = (await fs.readJson(this.bracketsFile)) as BracketStore;
      this.brackets = Array.isArray(store.brackets) ? store.brackets : [];
    } else {
      this.brackets = [];
      await this.save();
    }
    this.logger.info(`BracketManager initialized (${this.brackets.length} brackets)`);
  }

  private async save(): Promise<void> {
    await fs.writeJson(this.bracketsFile, { brackets: this.brackets } satisfies BracketStore, {
      spaces: 2
    });
  }

  listBrackets(competitionId?: string): EliminationBracket[] {
    const all = [...this.brackets].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    if (!competitionId) return all;
    return all.filter((b) => b.competitionId === competitionId);
  }

  getBracket(id: string): EliminationBracket | null {
    return this.brackets.find((b) => b.id === id) ?? null;
  }

  /**
   * Build a single-elimination bracket from the top seeds of a competition.
   * Higher seed score wins automatically in pending pairings (seeded resolution),
   * which fits arcade high-score events without requiring live head-to-head play.
   */
  async createFromCompetition(
    competitionId: string,
    options: { readonly size?: number; readonly name?: string } = {}
  ): Promise<EliminationBracket | null> {
    const competition = this.competitionManager.getCompetition(competitionId);
    if (!competition) return null;

    const existing = this.brackets.find((b) => b.competitionId === competitionId);
    if (existing) return existing;

    const requested = options.size ?? 8;
    const size = nextPowerOfTwo(Math.min(16, Math.max(2, requested)));
    const seeds = this.competitionManager.getLeaderboard(competitionId, size);

    const players: Array<LeaderboardEntry | null> = [...seeds];
    while (players.length < size) players.push(null);

    // Standard seeding: 1 vs N, 2 vs N-1, …
    const round1: BracketMatch[] = [];
    for (let i = 0; i < size / 2; i++) {
      const a = players[i];
      const b = players[size - 1 - i];
      const playerA = a
        ? { displayName: a.displayName, playerId: a.playerId, seedScore: a.score }
        : null;
      const playerB = b
        ? { displayName: b.displayName, playerId: b.playerId, seedScore: b.score }
        : null;
      const resolved = this.resolveMatch(playerA, playerB);
      round1.push({
        id: randomUUID(),
        round: 1,
        slot: i,
        playerA,
        playerB,
        winnerId: resolved.winnerId,
        winnerName: resolved.winnerName,
        status: resolved.status
      });
    }

    const allMatches = [...round1];
    let prevRound = round1;
    let round = 2;
    while (prevRound.length > 1) {
      const next: BracketMatch[] = [];
      for (let i = 0; i < prevRound.length; i += 2) {
        const left = prevRound[i];
        const right = prevRound[i + 1];
        const playerA =
          left?.status === 'complete' && left.winnerName
            ? {
                displayName: left.winnerName,
                playerId: left.winnerId,
                seedScore:
                  left.playerA?.displayName === left.winnerName
                    ? left.playerA.seedScore
                    : left.playerB?.seedScore ?? 0
              }
            : null;
        const playerB =
          right?.status === 'complete' && right.winnerName
            ? {
                displayName: right.winnerName,
                playerId: right.winnerId,
                seedScore:
                  right.playerA?.displayName === right.winnerName
                    ? right.playerA.seedScore
                    : right.playerB?.seedScore ?? 0
              }
            : null;
        const resolved = this.resolveMatch(playerA, playerB);
        const match: BracketMatch = {
          id: randomUUID(),
          round,
          slot: i / 2,
          playerA,
          playerB,
          winnerId: resolved.winnerId,
          winnerName: resolved.winnerName,
          status: resolved.status
        };
        next.push(match);
        allMatches.push(match);
      }
      prevRound = next;
      round += 1;
    }

    const finalMatch = allMatches.filter((m) => m.round === round - 1)[0];
    const bracket: EliminationBracket = {
      id: randomUUID(),
      competitionId,
      seasonId: competition.seasonId ?? null,
      name: options.name ?? `${competition.name} Bracket`,
      size,
      createdAt: new Date().toISOString(),
      matches: allMatches,
      championName: finalMatch?.winnerName ?? null
    };

    this.brackets.push(bracket);
    await this.save();
    await this.analyticsManager.trackEvent('bracket_created', 'game_activity', {
      bracketId: bracket.id,
      competitionId,
      size,
      championName: bracket.championName
    });
    this.logger.info(`Bracket created for ${competitionId}: champion=${bracket.championName}`);
    return bracket;
  }

  private resolveMatch(
    playerA: BracketMatch['playerA'],
    playerB: BracketMatch['playerB']
  ): { winnerId: string | null; winnerName: string | null; status: BracketMatch['status'] } {
    if (!playerA && !playerB) {
      return { winnerId: null, winnerName: null, status: 'pending' };
    }
    if (playerA && !playerB) {
      return { winnerId: playerA.playerId, winnerName: playerA.displayName, status: 'complete' };
    }
    if (!playerA && playerB) {
      return { winnerId: playerB.playerId, winnerName: playerB.displayName, status: 'complete' };
    }
    if (playerA && playerB) {
      const aWins = playerA.seedScore >= playerB.seedScore;
      const winner = aWins ? playerA : playerB;
      return {
        winnerId: winner.playerId,
        winnerName: winner.displayName,
        status: 'complete'
      };
    }
    return { winnerId: null, winnerName: null, status: 'ready' };
  }
}
