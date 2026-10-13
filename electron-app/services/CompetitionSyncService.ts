import * as fs from 'fs-extra';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { Logger } from '../utils/Logger';
import { ConfigManager } from '../config/AppConfig';
import { CompetitionManager } from './CompetitionManager';
import {
  Competition,
  CompetitionTransport,
  ScoreSubmission,
  SyncQueueItem
} from './competition/types';

interface SyncStore {
  queue: SyncQueueItem[];
  lastPullCursor: string | null;
}

/**
 * File-based venue hub transport for local/dev Phase 3.
 * Writes/reads shared JSON under data/competition-hub/ so multiple cabinets
 * on the same machine (or shared folder) can exchange results.
 */
export class FileHubTransport implements CompetitionTransport {
  constructor(private readonly hubDir: string) {}

  private inboxPath(): string {
    return path.join(this.hubDir, 'inbox.json');
  }

  async push(
    items: readonly SyncQueueItem[]
  ): Promise<{ readonly accepted: readonly string[]; readonly failed: readonly { id: string; error: string }[] }> {
    await fs.ensureDir(this.hubDir);
    let existing: SyncQueueItem[] = [];
    if (await fs.pathExists(this.inboxPath())) {
      const raw = await fs.readJson(this.inboxPath());
      existing = Array.isArray(raw.items) ? raw.items : [];
    }
    const accepted: string[] = [];
    for (const item of items) {
      if (!existing.some((e) => e.id === item.id)) {
        existing.push(item);
      }
      accepted.push(item.id);
    }
    await fs.writeJson(this.inboxPath(), { items: existing, updatedAt: new Date().toISOString() }, { spaces: 2 });
    return { accepted, failed: [] };
  }

  async pull(since: string | null): Promise<{ readonly items: readonly SyncQueueItem[]; readonly cursor: string }> {
    await fs.ensureDir(this.hubDir);
    if (!(await fs.pathExists(this.inboxPath()))) {
      return { items: [], cursor: since ?? new Date(0).toISOString() };
    }
    const raw = await fs.readJson(this.inboxPath());
    const items: SyncQueueItem[] = Array.isArray(raw.items) ? raw.items : [];
    const filtered = since
      ? items.filter((i) => i.createdAt > since)
      : items;
    const cursor = filtered.reduce(
      (max, i) => (i.createdAt > max ? i.createdAt : max),
      since ?? new Date(0).toISOString()
    );
    return { items: filtered, cursor };
  }
}

export class CompetitionSyncService {
  private readonly logger: Logger;
  private readonly configManager: ConfigManager;
  private readonly competitionManager: CompetitionManager;
  private readonly transport: CompetitionTransport;
  private readonly storeFile: string;
  private queue: SyncQueueItem[] = [];
  private lastPullCursor: string | null = null;
  private timer: NodeJS.Timeout | null = null;
  private arcadeId = 'local';

  constructor(
    competitionManager: CompetitionManager,
    transport?: CompetitionTransport
  ) {
    this.logger = new Logger();
    this.configManager = ConfigManager.getInstance();
    this.competitionManager = competitionManager;
    this.storeFile = path.join(process.cwd(), 'data', 'competition-sync-queue.json');
    this.transport =
      transport ??
      new FileHubTransport(path.join(process.cwd(), 'data', 'competition-hub'));
  }

  setArcadeId(arcadeId: string): void {
    this.arcadeId = arcadeId;
  }

  async initialize(): Promise<void> {
    await fs.ensureDir(path.dirname(this.storeFile));
    if (await fs.pathExists(this.storeFile)) {
      const store = (await fs.readJson(this.storeFile)) as SyncStore;
      this.queue = Array.isArray(store.queue) ? store.queue : [];
      this.lastPullCursor = store.lastPullCursor ?? null;
    } else {
      await this.save();
    }

    if (this.configManager.isCompetitionSyncEnabled()) {
      const interval = this.configManager.getConfig().competitions.syncIntervalMs;
      this.timer = setInterval(() => {
        void this.syncNow();
      }, interval);
      this.logger.info('CompetitionSyncService started');
    } else {
      this.logger.info('Competition sync disabled');
    }
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private async save(): Promise<void> {
    const store: SyncStore = { queue: this.queue, lastPullCursor: this.lastPullCursor };
    await fs.writeJson(this.storeFile, store, { spaces: 2 });
  }

  enqueue(kind: SyncQueueItem['kind'], payload: unknown): void {
    this.queue.push({
      id: randomUUID(),
      kind,
      payload,
      createdAt: new Date().toISOString(),
      attempts: 0,
      lastError: null
    });
    void this.save();
  }

  enqueueScore(submission: ScoreSubmission): void {
    this.enqueue('score', submission);
  }

  enqueueCompetition(competition: Competition): void {
    this.enqueue('competition', competition);
  }

  getQueue(): SyncQueueItem[] {
    return [...this.queue];
  }

  async syncNow(): Promise<{ pushed: number; pulled: number }> {
    if (!this.configManager.isCompetitionSyncEnabled()) {
      return { pushed: 0, pulled: 0 };
    }

    let pushed = 0;
    let pulled = 0;

    if (this.queue.length > 0) {
      const pending = [...this.queue];
      const result = await this.transport.push(pending);
      const accepted = new Set(result.accepted);
      const failedMap = new Map(result.failed.map((f) => [f.id, f.error]));
      pushed = accepted.size;
      this.queue = pending
        .filter((i) => !accepted.has(i.id))
        .map((i) =>
          failedMap.has(i.id)
            ? {
                ...i,
                attempts: i.attempts + 1,
                lastError: failedMap.get(i.id) ?? i.lastError
              }
            : i
        );
      await this.save();
    }

    const pull = await this.transport.pull(this.lastPullCursor);
    for (const item of pull.items) {
      // Skip our own echo if payload carries arcadeId matching us
      if (item.kind === 'score') {
        const score = item.payload as ScoreSubmission;
        if (score.arcadeId === this.arcadeId) continue;
        const merged = await this.competitionManager.mergeRemoteSubmission(score);
        if (merged) pulled += 1;
      } else if (item.kind === 'competition') {
        const competition = item.payload as Competition;
        await this.competitionManager.mergeRemoteCompetition(competition);
        pulled += 1;
      }
    }
    this.lastPullCursor = pull.cursor;
    await this.save();

    this.logger.info(`Competition sync complete pushed=${pushed} pulled=${pulled}`);
    return { pushed, pulled };
  }
}
