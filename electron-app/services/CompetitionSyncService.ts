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
  SyncQueueItem,
  SyncStatus
} from './competition/types';

interface SyncStore {
  queue: SyncQueueItem[];
  lastPullCursor: string | null;
  lastSyncAt: string | null;
  lastResult: { pushed: number; pulled: number } | null;
}

const MAX_ATTEMPTS = 8;

/**
 * File-based venue hub transport for local/dev Phase 3.
 * Point multiple cabinets at the same hubDir (network share or shared folder)
 * to exchange competition results without a cloud backend.
 */
export class FileHubTransport implements CompetitionTransport {
  constructor(private readonly hubDir: string) {}

  getHubDir(): string {
    return this.hubDir;
  }

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
    // Cap hub size to avoid unbounded growth
    const capped = existing.slice(-5_000);
    await fs.writeJson(
      this.inboxPath(),
      { items: capped, updatedAt: new Date().toISOString() },
      { spaces: 2 }
    );
    return { accepted, failed: [] };
  }

  async pull(since: string | null): Promise<{ readonly items: readonly SyncQueueItem[]; readonly cursor: string }> {
    await fs.ensureDir(this.hubDir);
    if (!(await fs.pathExists(this.inboxPath()))) {
      return { items: [], cursor: since ?? new Date(0).toISOString() };
    }
    const raw = await fs.readJson(this.inboxPath());
    const items: SyncQueueItem[] = Array.isArray(raw.items) ? raw.items : [];
    const filtered = since ? items.filter((i) => i.createdAt > since) : items;
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
  private transport: FileHubTransport;
  private readonly usesCustomTransport: boolean;
  private readonly storeFile: string;
  private queue: SyncQueueItem[] = [];
  private lastPullCursor: string | null = null;
  private lastSyncAt: string | null = null;
  private lastResult: { pushed: number; pulled: number } | null = null;
  private timer: NodeJS.Timeout | null = null;
  private arcadeId = 'local';
  private onSyncComplete: ((status: SyncStatus) => void) | null = null;

  constructor(competitionManager: CompetitionManager, transport?: FileHubTransport) {
    this.logger = new Logger();
    this.configManager = ConfigManager.getInstance();
    this.competitionManager = competitionManager;
    this.storeFile = path.join(process.cwd(), 'data', 'competition-sync-queue.json');
    this.usesCustomTransport = !!transport;
    this.transport =
      transport ?? new FileHubTransport(this.configManager.getCompetitionHubDir());
  }

  setArcadeId(arcadeId: string): void {
    this.arcadeId = arcadeId;
  }

  setOnSyncComplete(handler: ((status: SyncStatus) => void) | null): void {
    this.onSyncComplete = handler;
  }

  async initialize(): Promise<void> {
    await fs.ensureDir(path.dirname(this.storeFile));
    if (await fs.pathExists(this.storeFile)) {
      const store = (await fs.readJson(this.storeFile)) as SyncStore;
      this.queue = Array.isArray(store.queue)
        ? store.queue.map((q) => ({
            ...q,
            originArcadeId: q.originArcadeId ?? 'unknown'
          }))
        : [];
      this.lastPullCursor = store.lastPullCursor ?? null;
      this.lastSyncAt = store.lastSyncAt ?? null;
      this.lastResult = store.lastResult ?? null;
    } else {
      await this.save();
    }

    if (!this.usesCustomTransport) {
      this.transport = new FileHubTransport(this.configManager.getCompetitionHubDir());
    }
    if (this.configManager.isCompetitionSyncEnabled()) {
      this.startTimer();
      this.logger.info(`CompetitionSyncService started hub=${this.transport.getHubDir()}`);
    } else {
      this.logger.info('Competition sync disabled');
    }
  }

  private startTimer(): void {
    this.stop();
    const interval = this.configManager.getConfig().competitions.syncIntervalMs;
    this.timer = setInterval(() => {
      void this.syncNow();
    }, interval);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  async setEnabled(enabled: boolean): Promise<SyncStatus> {
    this.configManager.setCompetitionSyncEnabled(enabled);
    if (enabled) {
      if (!this.usesCustomTransport) {
        this.transport = new FileHubTransport(this.configManager.getCompetitionHubDir());
      }
      this.startTimer();
      await this.syncNow();
    } else {
      this.stop();
    }
    return this.getStatus();
  }

  private async save(): Promise<void> {
    const store: SyncStore = {
      queue: this.queue,
      lastPullCursor: this.lastPullCursor,
      lastSyncAt: this.lastSyncAt,
      lastResult: this.lastResult
    };
    await fs.writeJson(this.storeFile, store, { spaces: 2 });
  }

  enqueue(kind: SyncQueueItem['kind'], payload: unknown): void {
    this.queue.push({
      id: randomUUID(),
      kind,
      payload,
      createdAt: new Date().toISOString(),
      attempts: 0,
      lastError: null,
      originArcadeId: this.arcadeId
    });
    void this.save();
  }

  enqueueScore(submission: ScoreSubmission): void {
    this.enqueue('score', { ...submission, arcadeId: submission.arcadeId ?? this.arcadeId });
  }

  enqueueCompetition(competition: Competition): void {
    this.enqueue('competition', competition);
  }

  getQueue(): SyncQueueItem[] {
    return [...this.queue];
  }

  getStatus(): SyncStatus {
    return {
      enabled: this.configManager.isCompetitionSyncEnabled(),
      queueDepth: this.queue.length,
      lastPullCursor: this.lastPullCursor,
      lastSyncAt: this.lastSyncAt,
      lastResult: this.lastResult,
      hubDir: this.transport.getHubDir(),
      arcadeId: this.arcadeId
    };
  }

  async syncNow(): Promise<{ pushed: number; pulled: number }> {
    if (!this.configManager.isCompetitionSyncEnabled()) {
      return { pushed: 0, pulled: 0 };
    }

    let pushed = 0;
    let pulled = 0;

    try {
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
              : { ...i, attempts: i.attempts + 1, lastError: i.lastError ?? 'not_accepted' }
          )
          .filter((i) => i.attempts < MAX_ATTEMPTS);
        await this.save();
      }

      const pull = await this.transport.pull(this.lastPullCursor);
      for (const item of pull.items) {
        if (item.originArcadeId && item.originArcadeId === this.arcadeId) continue;

        if (item.kind === 'score') {
          const score = item.payload as ScoreSubmission;
          if (score.arcadeId === this.arcadeId) continue;
          const merged = await this.competitionManager.mergeRemoteSubmission(score);
          if (merged === 'inserted' || merged === 'replaced') pulled += 1;
        } else if (item.kind === 'competition') {
          await this.competitionManager.mergeRemoteCompetition(item.payload as Competition);
          pulled += 1;
        }
      }
      this.lastPullCursor = pull.cursor;
      this.lastSyncAt = new Date().toISOString();
      this.lastResult = { pushed, pulled };
      await this.save();

      this.logger.info(`Competition sync complete pushed=${pushed} pulled=${pulled}`);
      this.onSyncComplete?.(this.getStatus());
      return { pushed, pulled };
    } catch (error) {
      this.logger.error('Competition sync failed:', error);
      this.lastResult = { pushed, pulled };
      await this.save();
      return { pushed, pulled };
    }
  }
}
