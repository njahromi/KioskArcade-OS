import {
  GameCompetitionAdapter,
  ScoreProgress,
  ScoreSample
} from './competition/types';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseProgress(raw: unknown): ScoreProgress | null {
  if (!isRecord(raw)) return null;
  const progress: ScoreProgress = {
    level: typeof raw.level === 'number' ? raw.level : undefined,
    elapsedMs: typeof raw.elapsedMs === 'number' ? raw.elapsedMs : undefined,
    completed: typeof raw.completed === 'boolean' ? raw.completed : undefined,
    lines: typeof raw.lines === 'number' ? raw.lines : undefined,
    length: typeof raw.length === 'number' ? raw.length : undefined
  };
  return progress;
}

function createAdapter(
  gameId: string,
  plausibleRange: { min: number; max: number }
): GameCompetitionAdapter {
  return {
    gameId,
    plausibleRange,
    isSupported(): boolean {
      return true;
    },
    normalizeScoreEvent(raw: unknown): ScoreSample | null {
      if (!isRecord(raw)) return null;

      const type = raw.type;
      if (type !== 'kioskarcade:score' && type !== undefined) {
        // Allow bare payloads from guest preload without type wrapper
        if (typeof raw.score !== 'number') return null;
      }

      const id = typeof raw.gameId === 'string' ? raw.gameId : gameId;
      if (id !== gameId) return null;

      const score = typeof raw.score === 'number' ? raw.score : null;
      if (score === null || !Number.isFinite(score)) return null;

      const event = raw.event === 'final' ? 'final' : 'update';
      return {
        gameId: id,
        score: Math.floor(score),
        event,
        progress: parseProgress(raw.progress),
        reportedAt: typeof raw.reportedAt === 'string' ? raw.reportedAt : new Date().toISOString()
      };
    }
  };
}

export class GameAdapterManager {
  private readonly adapters = new Map<string, GameCompetitionAdapter>();

  constructor() {
    this.register(createAdapter('tetris', { min: 0, max: 999_999 }));
    this.register(createAdapter('snake', { min: 0, max: 100_000 }));
    this.register(createAdapter('pong', { min: 0, max: 50_000 }));
  }

  register(adapter: GameCompetitionAdapter): void {
    this.adapters.set(adapter.gameId, adapter);
  }

  getAdapter(gameId: string): GameCompetitionAdapter | null {
    return this.adapters.get(gameId) ?? null;
  }

  isSupported(gameId: string): boolean {
    const adapter = this.adapters.get(gameId);
    return adapter?.isSupported() === true;
  }

  listSupportedGameIds(): string[] {
    return Array.from(this.adapters.keys()).filter((id) => this.adapters.get(id)?.isSupported());
  }

  normalize(gameId: string, raw: unknown): ScoreSample | null {
    const adapter = this.getAdapter(gameId);
    if (!adapter) return null;
    return adapter.normalizeScoreEvent(raw);
  }
}
