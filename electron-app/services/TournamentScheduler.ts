import * as fs from 'fs-extra';
import * as path from 'path';
import { Logger } from '../utils/Logger';
import { CompetitionManager } from './CompetitionManager';
import { CreateCompetitionInput } from './competition/types';

export type ScheduleCadence = 'daily' | 'weekly' | 'once';

export interface TournamentSchedule {
  readonly id: string;
  readonly name: string;
  readonly gameId: string;
  readonly cadence: ScheduleCadence;
  /** HH:mm local */
  readonly startTime: string;
  /** Duration in minutes */
  readonly durationMinutes: number;
  readonly enabled: boolean;
  readonly lastSpawnedDate: string | null;
  readonly seasonId: string | null;
  readonly bracketEnabled: boolean;
}

interface ScheduleStore {
  schedules: TournamentSchedule[];
}

export class TournamentScheduler {
  private readonly logger: Logger;
  private readonly schedulesFile: string;
  private readonly competitionManager: CompetitionManager;
  private schedules: TournamentSchedule[] = [];
  private timer: NodeJS.Timeout | null = null;

  constructor(competitionManager: CompetitionManager) {
    this.logger = new Logger();
    this.competitionManager = competitionManager;
    this.schedulesFile = path.join(process.cwd(), 'data', 'tournament-schedules.json');
  }

  async initialize(): Promise<void> {
    await fs.ensureDir(path.dirname(this.schedulesFile));
    if (await fs.pathExists(this.schedulesFile)) {
      const store = (await fs.readJson(this.schedulesFile)) as ScheduleStore;
      this.schedules = Array.isArray(store.schedules) ? store.schedules : [];
    } else {
      this.schedules = [];
      await this.save();
    }
    this.timer = setInterval(() => {
      void this.tick();
    }, 60_000);
    await this.tick();
    this.logger.info(`TournamentScheduler initialized (${this.schedules.length} schedules)`);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private async save(): Promise<void> {
    await fs.writeJson(this.schedulesFile, { schedules: this.schedules } satisfies ScheduleStore, {
      spaces: 2
    });
  }

  listSchedules(): TournamentSchedule[] {
    return [...this.schedules];
  }

  async upsertSchedule(
    schedule: Omit<TournamentSchedule, 'lastSpawnedDate'> & { lastSpawnedDate?: string | null }
  ): Promise<TournamentSchedule> {
    const next: TournamentSchedule = {
      ...schedule,
      lastSpawnedDate: schedule.lastSpawnedDate ?? null
    };
    const idx = this.schedules.findIndex((s) => s.id === next.id);
    if (idx >= 0) {
      this.schedules[idx] = next;
    } else {
      this.schedules.push(next);
    }
    await this.save();
    return next;
  }

  async removeSchedule(id: string): Promise<boolean> {
    const before = this.schedules.length;
    this.schedules = this.schedules.filter((s) => s.id !== id);
    if (this.schedules.length === before) return false;
    await this.save();
    return true;
  }

  private localDateKey(d = new Date()): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  private shouldSpawnToday(schedule: TournamentSchedule, now: Date): boolean {
    if (!schedule.enabled) return false;
    if (schedule.lastSpawnedDate === this.localDateKey(now)) return false;

    const [hh, mm] = schedule.startTime.split(':').map((n) => Number(n));
    if (!Number.isFinite(hh) || !Number.isFinite(mm)) return false;

    const start = new Date(now);
    start.setHours(hh, mm, 0, 0);
    if (now < start) return false;

    if (schedule.cadence === 'weekly' && now.getDay() !== 1) {
      // Spawn weekly championships on Mondays by default
      return false;
    }
    if (schedule.cadence === 'once' && schedule.lastSpawnedDate) return false;
    return true;
  }

  async tick(): Promise<void> {
    const now = new Date();
    for (let i = 0; i < this.schedules.length; i++) {
      const schedule = this.schedules[i];
      if (!this.shouldSpawnToday(schedule, now)) continue;

      const endsAt = new Date(now.getTime() + schedule.durationMinutes * 60_000).toISOString();
      const input: CreateCompetitionInput = {
        name: schedule.name,
        gameId: schedule.gameId,
        metric: 'high_score',
        startsAt: now.toISOString(),
        endsAt,
        seasonId: schedule.seasonId,
        bracketEnabled: schedule.bracketEnabled
      };
      const created = await this.competitionManager.createCompetition(input);
      if (created) {
        this.schedules[i] = { ...schedule, lastSpawnedDate: this.localDateKey(now) };
        await this.save();
        this.logger.info(`Spawned scheduled tournament ${schedule.id} → ${created.id}`);
      }
    }

    // Auto-end competitions past endsAt
    for (const c of this.competitionManager.listCompetitions()) {
      if (c.status !== 'active' || !c.endsAt) continue;
      if (Date.parse(c.endsAt) < Date.now()) {
        await this.competitionManager.endCompetition(c.id);
      }
    }
  }
}
