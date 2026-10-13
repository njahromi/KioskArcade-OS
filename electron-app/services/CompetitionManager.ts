import * as fs from 'fs-extra';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { Logger } from '../utils/Logger';
import { ConfigManager } from '../config/AppConfig';
import { AnalyticsManager } from './AnalyticsManager';
import { GameAdapterManager } from './GameAdapterManager';
import { ScoreValidationService } from './ScoreValidationService';
import {
  ActiveGameSession,
  Competition,
  CreateCompetitionInput,
  LeaderboardEntry,
  ScoreSample,
  ScoreSubmission
} from './competition/types';

interface CompetitionStore {
  competitions: Competition[];
}

interface ScoreStore {
  submissions: ScoreSubmission[];
}

export class CompetitionManager {
  private readonly logger: Logger;
  private readonly configManager: ConfigManager;
  private readonly analyticsManager: AnalyticsManager;
  private readonly adapterManager: GameAdapterManager;
  private readonly validationService: ScoreValidationService;
  private readonly competitionsFile: string;
  private readonly scoresFile: string;
  private competitions: Competition[] = [];
  private submissions: ScoreSubmission[] = [];
  private activeSession: ActiveGameSession | null = null;
  private displayName = 'Player';
  private playerId: string | null = null;
  private arcadeId = 'ARCADE_DEFAULT';
  private locationId = 'LOC_DEFAULT';

  constructor(
    analyticsManager: AnalyticsManager,
    adapterManager?: GameAdapterManager,
    validationService?: ScoreValidationService
  ) {
    this.logger = new Logger();
    this.configManager = ConfigManager.getInstance();
    this.analyticsManager = analyticsManager;
    this.adapterManager = adapterManager ?? new GameAdapterManager();
    this.validationService = validationService ?? new ScoreValidationService();
    const dataDir = path.join(process.cwd(), 'data');
    this.competitionsFile = path.join(dataDir, 'competitions.json');
    this.scoresFile = path.join(dataDir, 'competition-scores.json');
  }

  setIdentityContext(arcadeId: string, locationId: string): void {
    this.arcadeId = arcadeId;
    this.locationId = locationId;
  }

  getAdapterManager(): GameAdapterManager {
    return this.adapterManager;
  }

  async initialize(): Promise<void> {
    try {
      if (!this.configManager.isCompetitionsEnabled()) {
        this.logger.info('Competitions disabled, skipping CompetitionManager init');
        return;
      }
      await fs.ensureDir(path.dirname(this.competitionsFile));
      await Promise.all([this.loadCompetitions(), this.loadScores()]);
      this.logger.info(
        `CompetitionManager initialized (${this.competitions.length} competitions, ${this.submissions.length} scores)`
      );
    } catch (error) {
      this.logger.error('Failed to initialize CompetitionManager:', error);
      throw error;
    }
  }

  private async loadCompetitions(): Promise<void> {
    if (await fs.pathExists(this.competitionsFile)) {
      const store = (await fs.readJson(this.competitionsFile)) as CompetitionStore;
      this.competitions = Array.isArray(store.competitions) ? store.competitions : [];
    } else {
      this.competitions = [];
      await this.saveCompetitions();
    }
  }

  private async loadScores(): Promise<void> {
    if (await fs.pathExists(this.scoresFile)) {
      const store = (await fs.readJson(this.scoresFile)) as ScoreStore;
      this.submissions = Array.isArray(store.submissions) ? store.submissions : [];
    } else {
      this.submissions = [];
      await this.saveScores();
    }
  }

  private async saveCompetitions(): Promise<void> {
    const store: CompetitionStore = { competitions: this.competitions };
    await fs.writeJson(this.competitionsFile, store, { spaces: 2 });
  }

  private async saveScores(): Promise<void> {
    const store: ScoreStore = { submissions: this.submissions };
    await fs.writeJson(this.scoresFile, store, { spaces: 2 });
  }

  isEnabled(): boolean {
    return this.configManager.isCompetitionsEnabled();
  }

  listCompetitions(): Competition[] {
    return [...this.competitions].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  getActiveCompetition(gameId?: string): Competition | null {
    const now = Date.now();
    const active = this.competitions.filter((c) => {
      if (c.status !== 'active') return false;
      if (gameId && c.gameId !== gameId) return false;
      const start = Date.parse(c.startsAt);
      if (Number.isFinite(start) && start > now) return false;
      if (c.endsAt) {
        const end = Date.parse(c.endsAt);
        if (Number.isFinite(end) && end < now) return false;
      }
      return true;
    });
    return active[0] ?? null;
  }

  getCompetition(id: string): Competition | null {
    return this.competitions.find((c) => c.id === id) ?? null;
  }

  async createCompetition(input: CreateCompetitionInput): Promise<Competition | null> {
    if (!this.isEnabled()) return null;
    if (!this.adapterManager.isSupported(input.gameId)) {
      this.logger.warn(`Cannot create competition for unsupported game: ${input.gameId}`);
      return null;
    }

    const competition: Competition = {
      id: randomUUID(),
      name: input.name.trim() || `${input.gameId} Challenge`,
      gameId: input.gameId,
      metric: input.metric ?? 'high_score',
      status: 'active',
      startsAt: input.startsAt ?? new Date().toISOString(),
      endsAt: input.endsAt ?? null,
      createdAt: new Date().toISOString(),
      seasonId: input.seasonId ?? null,
      bracketEnabled: input.bracketEnabled ?? false
    };

    this.competitions.push(competition);
    await this.saveCompetitions();
    await this.analyticsManager.trackEvent('competition_created', 'game_activity', {
      competitionId: competition.id,
      gameId: competition.gameId,
      name: competition.name
    });
    this.logger.info(`Competition created: ${competition.id}`);
    return competition;
  }

  async endCompetition(competitionId: string): Promise<boolean> {
    const idx = this.competitions.findIndex((c) => c.id === competitionId);
    if (idx < 0) return false;
    const current = this.competitions[idx];
    this.competitions[idx] = {
      ...current,
      status: 'ended',
      endsAt: current.endsAt ?? new Date().toISOString()
    };
    await this.saveCompetitions();
    await this.analyticsManager.trackEvent('competition_ended', 'game_activity', {
      competitionId,
      gameId: current.gameId
    });
    return true;
  }

  setDisplayName(displayName: string): string {
    const cleaned = displayName.trim().slice(0, 24) || 'Player';
    this.displayName = cleaned;
    return cleaned;
  }

  getDisplayName(): string {
    return this.displayName;
  }

  setPlayerId(playerId: string | null): void {
    this.playerId = playerId;
  }

  getPlayerId(): string | null {
    return this.playerId;
  }

  startGameSession(gameId: string): ActiveGameSession {
    const competition = this.getActiveCompetition(gameId);
    const session: ActiveGameSession = {
      sessionId: randomUUID(),
      gameId,
      competitionId: competition?.id ?? null,
      displayName: this.displayName,
      playerId: this.playerId,
      startedAt: new Date().toISOString(),
      lastScore: 0,
      lastProgress: null,
      finalized: false
    };
    this.activeSession = session;
    this.logger.info(`Game session started: ${session.sessionId} game=${gameId}`);
    return session;
  }

  getActiveSession(): ActiveGameSession | null {
    return this.activeSession;
  }

  async handleScoreEvent(raw: unknown): Promise<ScoreSubmission | null> {
    if (!this.isEnabled() || !this.activeSession) return null;

    const session = this.activeSession;
    const sample =
      this.adapterManager.normalize(session.gameId, raw) ??
      this.tryNormalizeLoose(session.gameId, raw);
    if (!sample) return null;

    session.lastScore = sample.score;
    session.lastProgress = sample.progress ?? null;

    if (sample.event !== 'final') {
      return null;
    }

    return this.finalizeSession(sample);
  }

  private tryNormalizeLoose(gameId: string, raw: unknown): ScoreSample | null {
    if (typeof raw !== 'object' || raw === null) return null;
    const record = raw as Record<string, unknown>;
    if (typeof record.score !== 'number') return null;
    return {
      gameId,
      score: Math.floor(record.score),
      event: record.event === 'final' ? 'final' : 'update',
      progress: null,
      reportedAt: new Date().toISOString()
    };
  }

  async finalizeSession(sample?: ScoreSample): Promise<ScoreSubmission | null> {
    const session = this.activeSession;
    if (!session || session.finalized) return null;

    const finalSample: ScoreSample = sample ?? {
      gameId: session.gameId,
      score: session.lastScore,
      event: 'final',
      progress: session.lastProgress,
      reportedAt: new Date().toISOString()
    };

    const adapter = this.adapterManager.getAdapter(session.gameId);
    const validation = this.validationService.validate(finalSample, session, adapter);
    session.finalized = true;
    this.validationService.markFinalized(session.sessionId);

    if (!session.competitionId) {
      this.logger.info('No active competition; score not persisted');
      return null;
    }

    if (validation.status === 'rejected') {
      this.logger.warn(`Score rejected: ${validation.reason}`);
      await this.analyticsManager.trackEvent('competition_score_rejected', 'game_activity', {
        sessionId: session.sessionId,
        reason: validation.reason,
        score: finalSample.score
      });
      return null;
    }

    const submission: ScoreSubmission = {
      id: randomUUID(),
      competitionId: session.competitionId,
      gameId: session.gameId,
      displayName: session.displayName,
      playerId: session.playerId,
      score: finalSample.score,
      sessionId: session.sessionId,
      submittedAt: new Date().toISOString(),
      source: 'adapter',
      validation: validation.status,
      arcadeId: this.arcadeId,
      locationId: this.locationId,
      progress: finalSample.progress ?? null,
      validationReason: validation.reason
    };

    this.submissions.push(submission);
    await this.saveScores();
    await this.analyticsManager.trackEvent('competition_score_submitted', 'game_activity', {
      competitionId: submission.competitionId,
      gameId: submission.gameId,
      score: submission.score,
      validation: submission.validation,
      displayName: submission.displayName
    });
    this.logger.info(`Score submitted: ${submission.score} (${submission.validation})`);
    return submission;
  }

  clearActiveSession(): void {
    if (this.activeSession) {
      this.validationService.clearSession(this.activeSession.sessionId);
    }
    this.activeSession = null;
  }

  getLeaderboard(competitionId: string, limit = 20): LeaderboardEntry[] {
    const competition = this.getCompetition(competitionId);
    const metric = competition?.metric ?? 'high_score';

    const accepted = this.submissions.filter(
      (s) =>
        s.competitionId === competitionId &&
        (s.validation === 'accepted' || s.validation === 'flagged')
    );

    // Best score per display identity (playerId or displayName)
    const best = new Map<string, ScoreSubmission>();
    for (const s of accepted) {
      const key = s.playerId ?? `name:${s.displayName.toLowerCase()}`;
      const existing = best.get(key);
      if (!existing) {
        best.set(key, s);
        continue;
      }
      const better =
        metric === 'fastest_time' ? s.score < existing.score : s.score > existing.score;
      if (better) best.set(key, s);
    }

    const sorted = Array.from(best.values()).sort((a, b) => {
      if (metric === 'fastest_time') return a.score - b.score;
      // Prefer accepted over flagged when scores equal
      if (b.score !== a.score) return b.score - a.score;
      if (a.validation !== b.validation) {
        return a.validation === 'accepted' ? -1 : 1;
      }
      return a.submittedAt.localeCompare(b.submittedAt);
    });

    return sorted.slice(0, limit).map((s, index) => ({
      rank: index + 1,
      displayName: s.displayName,
      playerId: s.playerId,
      score: s.score,
      submittedAt: s.submittedAt,
      validation: s.validation,
      submissionId: s.id
    }));
  }

  getFlaggedSubmissions(competitionId?: string): ScoreSubmission[] {
    return this.submissions.filter(
      (s) =>
        s.validation === 'flagged' &&
        (!competitionId || s.competitionId === competitionId)
    );
  }

  async reviewSubmission(
    submissionId: string,
    decision: 'accepted' | 'rejected'
  ): Promise<ScoreSubmission | null> {
    const idx = this.submissions.findIndex((s) => s.id === submissionId);
    if (idx < 0) return null;
    const current = this.submissions[idx];
    this.submissions[idx] = {
      ...current,
      validation: decision,
      validationReason: decision === 'accepted' ? 'admin_approved' : 'admin_rejected'
    };
    await this.saveScores();
    return this.submissions[idx];
  }

  private identityKey(submission: ScoreSubmission): string {
    if (submission.playerId) return `player:${submission.playerId}`;
    return `name:${submission.displayName.toLowerCase()}`;
  }

  /**
   * Merge a remote score.
   * - Exact id / session duplicates are skipped.
   * - Same player (or display name) in the same competition: keep higher score (max-score-wins).
   * - Rejected remotes are ignored; flagged/accepted are kept.
   */
  async mergeRemoteSubmission(submission: ScoreSubmission): Promise<'inserted' | 'replaced' | 'skipped'> {
    if (submission.validation === 'rejected') return 'skipped';

    if (this.submissions.some((s) => s.id === submission.id)) {
      return 'skipped';
    }

    if (
      this.submissions.some(
        (s) => s.sessionId === submission.sessionId && s.competitionId === submission.competitionId
      )
    ) {
      return 'skipped';
    }

    const competition = this.getCompetition(submission.competitionId);
    const metric = competition?.metric ?? 'high_score';
    const key = this.identityKey(submission);
    const existingIdx = this.submissions.findIndex(
      (s) =>
        s.competitionId === submission.competitionId &&
        this.identityKey(s) === key &&
        s.validation !== 'rejected'
    );

    if (existingIdx >= 0) {
      const existing = this.submissions[existingIdx];
      const remoteBetter =
        metric === 'fastest_time'
          ? submission.score < existing.score
          : submission.score > existing.score;
      if (!remoteBetter) return 'skipped';
      this.submissions[existingIdx] = submission;
      await this.saveScores();
      return 'replaced';
    }

    this.submissions.push(submission);
    await this.saveScores();
    return 'inserted';
  }

  async mergeRemoteCompetition(competition: Competition): Promise<'inserted' | 'updated'> {
    const idx = this.competitions.findIndex((c) => c.id === competition.id);
    if (idx >= 0) {
      const current = this.competitions[idx];
      // Prefer ended status and later endsAt from remote when resolving conflicts
      this.competitions[idx] = {
        ...current,
        ...competition,
        status:
          current.status === 'ended' || competition.status === 'ended'
            ? 'ended'
            : competition.status
      };
      await this.saveCompetitions();
      return 'updated';
    }
    this.competitions.push(competition);
    await this.saveCompetitions();
    return 'inserted';
  }

  getAllSubmissions(): ScoreSubmission[] {
    return [...this.submissions];
  }
}
