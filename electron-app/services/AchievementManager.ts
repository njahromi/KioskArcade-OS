import * as fs from 'fs-extra';
import * as path from 'path';
import { Logger } from '../utils/Logger';
import { PlayerProfileManager } from './PlayerProfileManager';
import {
  AchievementDefinition,
  AchievementUnlock,
  ScoreProgress,
  ScoreSubmission
} from './competition/types';

interface AchievementStore {
  unlocks: AchievementUnlock[];
}

const DEFAULT_ACHIEVEMENTS: AchievementDefinition[] = [
  {
    id: 'tetris_100',
    gameId: 'tetris',
    name: 'Line Clearer',
    description: 'Score at least 100 in Tetris',
    rule: { type: 'score_at_least', value: 100 }
  },
  {
    id: 'tetris_lines_20',
    gameId: 'tetris',
    name: 'Stack Master',
    description: 'Clear 20 lines in a session',
    rule: { type: 'progress_field_at_least', field: 'lines', value: 20 }
  },
  {
    id: 'snake_50',
    gameId: 'snake',
    name: 'Growing Fast',
    description: 'Score at least 50 in Snake',
    rule: { type: 'score_at_least', value: 50 }
  },
  {
    id: 'snake_length_15',
    gameId: 'snake',
    name: 'Long Snake',
    description: 'Reach length 15',
    rule: { type: 'progress_field_at_least', field: 'length', value: 15 }
  },
  {
    id: 'pong_20',
    gameId: 'pong',
    name: 'Rally Starter',
    description: 'Score at least 20 in Pong',
    rule: { type: 'score_at_least', value: 20 }
  }
];

export class AchievementManager {
  private readonly logger: Logger;
  private readonly unlocksFile: string;
  private readonly definitions: AchievementDefinition[];
  private readonly profileManager: PlayerProfileManager;
  private unlocks: AchievementUnlock[] = [];

  constructor(profileManager: PlayerProfileManager, definitions?: AchievementDefinition[]) {
    this.logger = new Logger();
    this.profileManager = profileManager;
    this.definitions = definitions ?? DEFAULT_ACHIEVEMENTS;
    this.unlocksFile = path.join(process.cwd(), 'data', 'achievement-unlocks.json');
  }

  async initialize(): Promise<void> {
    await fs.ensureDir(path.dirname(this.unlocksFile));
    if (await fs.pathExists(this.unlocksFile)) {
      const store = (await fs.readJson(this.unlocksFile)) as AchievementStore;
      this.unlocks = Array.isArray(store.unlocks) ? store.unlocks : [];
    } else {
      this.unlocks = [];
      await this.save();
    }
    this.logger.info(`AchievementManager initialized (${this.definitions.length} definitions)`);
  }

  private async save(): Promise<void> {
    await fs.writeJson(this.unlocksFile, { unlocks: this.unlocks } satisfies AchievementStore, {
      spaces: 2
    });
  }

  listDefinitions(): AchievementDefinition[] {
    return [...this.definitions];
  }

  listUnlocks(playerId?: string): AchievementUnlock[] {
    if (!playerId) return [...this.unlocks];
    return this.unlocks.filter((u) => u.playerId === playerId);
  }

  private matches(
    def: AchievementDefinition,
    score: number,
    progress: ScoreProgress | null | undefined
  ): boolean {
    if (def.rule.type === 'score_at_least') {
      return score >= def.rule.value;
    }
    const value = progress?.[def.rule.field];
    return typeof value === 'number' && value >= def.rule.value;
  }

  async evaluateSubmission(submission: ScoreSubmission): Promise<AchievementUnlock[]> {
    if (!submission.playerId || submission.validation === 'rejected') {
      return [];
    }

    const newlyUnlocked: AchievementUnlock[] = [];
    for (const def of this.definitions) {
      if (def.gameId !== '*' && def.gameId !== submission.gameId) continue;
      const already = this.unlocks.some(
        (u) => u.playerId === submission.playerId && u.achievementId === def.id
      );
      if (already) continue;
      if (!this.matches(def, submission.score, submission.progress)) continue;

      const unlock: AchievementUnlock = {
        achievementId: def.id,
        playerId: submission.playerId,
        unlockedAt: new Date().toISOString(),
        competitionId: submission.competitionId
      };
      this.unlocks.push(unlock);
      await this.profileManager.addAchievement(submission.playerId, def.id);
      newlyUnlocked.push(unlock);
      this.logger.info(`Achievement unlocked: ${def.id} for ${submission.playerId}`);
    }

    if (newlyUnlocked.length > 0) {
      await this.save();
    }
    return newlyUnlocked;
  }
}
