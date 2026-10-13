import * as fs from 'fs-extra';
import * as path from 'path';
import { Logger } from '../utils/Logger';
import { CompetitionManager } from './CompetitionManager';
import { Competition, CreateCompetitionInput, UpcomingEvent } from './competition/types';

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
  /** 0=Sun … 6=Sat; used when cadence is weekly (default Monday=1) */
  readonly weeklyDay: number;
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
  private onCompetitionSpawned: ((competition: Competition) => void) | null = null;

  constructor(competitionManager: CompetitionManager) {
    this.logger = new Logger();
    this.competitionManager = competitionManager;
    this.schedulesFile = path.join(process.cwd(), 'data', 'tournament-schedules.json');
  }

  setOnCompetitionSpawned(handler: ((competition: Competition) => void) | null): void {
    this.onCompetitionSpawned = handler;
  }

  async initialize(): Promise<void> {
    await fs.ensureDir(path.dirname(this.schedulesFile));
    if (await fs.pathExists(this.schedulesFile)) {
      const store = (await fs.readJson(this.schedulesFile)) as ScheduleStore;
      this.schedules = Array.isArray(store.schedules)
        ? store.schedules.map((s) => ({
            ...s,
            weeklyDay: typeof s.weeklyDay === 'number' ? s.weeklyDay : 1
          }))
        : [];
    } else {
      this.schedules = [];
      await this.save();
    }
    this.timer = setInterval(() => {
      void this.tick();
    }, 30_000);
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
    schedule: Omit<TournamentSchedule, 'lastSpawnedDate' | 'weeklyDay'> & {
      lastSpawnedDate?: string | null;
      weeklyDay?: number;
    }
  ): Promise<TournamentSchedule> {
    const next: TournamentSchedule = {
      ...schedule,
      weeklyDay: schedule.weeklyDay ?? 1,
      lastSpawnedDate: schedule.lastSpawnedDate ?? null
    };
    const idx = this.schedules.findIndex((s) => s.id === next.id);
    if (idx >= 0) {
      this.schedules[idx] = {
        ...next,
        lastSpawnedDate: schedule.lastSpawnedDate ?? this.schedules[idx].lastSpawnedDate
      };
    } else {
      this.schedules.push(next);
    }
    await this.save();
    return this.schedules.find((s) => s.id === next.id)!;
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

  private parseStartTime(schedule: TournamentSchedule, day: Date): Date | null {
    const [hh, mm] = schedule.startTime.split(':').map((n) => Number(n));
    if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;
    const start = new Date(day);
    start.setHours(hh, mm, 0, 0);
    return start;
  }

  private shouldSpawnToday(schedule: TournamentSchedule, now: Date): boolean {
    if (!schedule.enabled) return false;
    if (schedule.lastSpawnedDate === this.localDateKey(now)) return false;

    const start = this.parseStartTime(schedule, now);
    if (!start || now < start) return false;

    if (schedule.cadence === 'weekly' && now.getDay() !== schedule.weeklyDay) {
      return false;
    }
    if (schedule.cadence === 'once' && schedule.lastSpawnedDate) return false;
    return true;
  }

  /** Next start datetime for idle / browser countdown. */
  getUpcomingEvents(limit = 5): UpcomingEvent[] {
    const now = new Date();
    const events: UpcomingEvent[] = [];

    for (const schedule of this.schedules) {
      if (!schedule.enabled) continue;
      const candidate = this.nextStartForSchedule(schedule, now);
      if (!candidate) continue;
      events.push({
        scheduleId: schedule.id,
        name: schedule.name,
        gameId: schedule.gameId,
        cadence: schedule.cadence,
        nextStartAt: candidate.toISOString(),
        durationMinutes: schedule.durationMinutes,
        enabled: schedule.enabled
      });
    }

    return events
      .sort((a, b) => a.nextStartAt.localeCompare(b.nextStartAt))
      .slice(0, limit);
  }

  private nextStartForSchedule(schedule: TournamentSchedule, now: Date): Date | null {
    if (schedule.cadence === 'once' && schedule.lastSpawnedDate) {
      return null;
    }

    if (schedule.cadence === 'weekly') {
      for (let i = 0; i < 14; i++) {
        const d = new Date(now);
        d.setDate(now.getDate() + i);
        if (d.getDay() !== schedule.weeklyDay) continue;
        const start = this.parseStartTime(schedule, d);
        if (!start) continue;
        if (start > now) return start;
        if (i === 0 && schedule.lastSpawnedDate !== this.localDateKey(now)) {
          // Due today but not yet marked spawned — treat as "now" for listing
          return start;
        }
      }
      return null;
    }

    // daily
    const today = this.parseStartTime(schedule, now);
    if (!today) return null;
    if (today > now) return today;
    if (schedule.lastSpawnedDate !== this.localDateKey(now)) return today;
    const tomorrow = new Date(now);
    tomorrow.setDate(now.getDate() + 1);
    return this.parseStartTime(schedule, tomorrow);
  }

  async tick(): Promise<Competition[]> {
    const now = new Date();
    const spawned: Competition[] = [];

    for (let i = 0; i < this.schedules.length; i++) {
      const schedule = this.schedules[i];
      if (!this.shouldSpawnToday(schedule, now)) continue;

      // Avoid duplicate active competitions for same schedule name+game while one is live
      const alreadyActive = this.competitionManager
        .listCompetitions()
        .some(
          (c) =>
            c.status === 'active' &&
            c.gameId === schedule.gameId &&
            c.name === schedule.name &&
            (!c.endsAt || Date.parse(c.endsAt) > Date.now())
        );
      if (alreadyActive) {
        this.schedules[i] = { ...schedule, lastSpawnedDate: this.localDateKey(now) };
        await this.save();
        continue;
      }

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
        spawned.push(created);
        this.onCompetitionSpawned?.(created);
        this.logger.info(`Spawned scheduled tournament ${schedule.id} → ${created.id}`);
      }
    }

    for (const c of this.competitionManager.listCompetitions()) {
      if (c.status !== 'active' || !c.endsAt) continue;
      if (Date.parse(c.endsAt) < Date.now()) {
        await this.competitionManager.endCompetition(c.id);
      }
    }

    return spawned;
  }
}
