"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.CompetitionManager = void 0;
const fs = __importStar(require("fs-extra"));
const path = __importStar(require("path"));
const crypto_1 = require("crypto");
const Logger_1 = require("../utils/Logger");
const AppConfig_1 = require("../config/AppConfig");
const GameAdapterManager_1 = require("./GameAdapterManager");
const ScoreValidationService_1 = require("./ScoreValidationService");
class CompetitionManager {
    constructor(analyticsManager, adapterManager, validationService) {
        this.competitions = [];
        this.submissions = [];
        this.activeSession = null;
        this.displayName = 'Player';
        this.playerId = null;
        this.arcadeId = 'ARCADE_DEFAULT';
        this.locationId = 'LOC_DEFAULT';
        this.logger = new Logger_1.Logger();
        this.configManager = AppConfig_1.ConfigManager.getInstance();
        this.analyticsManager = analyticsManager;
        this.adapterManager = adapterManager ?? new GameAdapterManager_1.GameAdapterManager();
        this.validationService = validationService ?? new ScoreValidationService_1.ScoreValidationService();
        const dataDir = path.join(process.cwd(), 'data');
        this.competitionsFile = path.join(dataDir, 'competitions.json');
        this.scoresFile = path.join(dataDir, 'competition-scores.json');
    }
    setIdentityContext(arcadeId, locationId) {
        this.arcadeId = arcadeId;
        this.locationId = locationId;
    }
    getAdapterManager() {
        return this.adapterManager;
    }
    async initialize() {
        try {
            if (!this.configManager.isCompetitionsEnabled()) {
                this.logger.info('Competitions disabled, skipping CompetitionManager init');
                return;
            }
            await fs.ensureDir(path.dirname(this.competitionsFile));
            await Promise.all([this.loadCompetitions(), this.loadScores()]);
            this.logger.info(`CompetitionManager initialized (${this.competitions.length} competitions, ${this.submissions.length} scores)`);
        }
        catch (error) {
            this.logger.error('Failed to initialize CompetitionManager:', error);
            throw error;
        }
    }
    async loadCompetitions() {
        if (await fs.pathExists(this.competitionsFile)) {
            const store = (await fs.readJson(this.competitionsFile));
            this.competitions = Array.isArray(store.competitions) ? store.competitions : [];
        }
        else {
            this.competitions = [];
            await this.saveCompetitions();
        }
    }
    async loadScores() {
        if (await fs.pathExists(this.scoresFile)) {
            const store = (await fs.readJson(this.scoresFile));
            this.submissions = Array.isArray(store.submissions) ? store.submissions : [];
        }
        else {
            this.submissions = [];
            await this.saveScores();
        }
    }
    async saveCompetitions() {
        const store = { competitions: this.competitions };
        await fs.writeJson(this.competitionsFile, store, { spaces: 2 });
    }
    async saveScores() {
        const store = { submissions: this.submissions };
        await fs.writeJson(this.scoresFile, store, { spaces: 2 });
    }
    isEnabled() {
        return this.configManager.isCompetitionsEnabled();
    }
    listCompetitions() {
        return [...this.competitions].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    }
    getActiveCompetition(gameId) {
        const now = Date.now();
        const active = this.competitions.filter((c) => {
            if (c.status !== 'active')
                return false;
            if (gameId && c.gameId !== gameId)
                return false;
            const start = Date.parse(c.startsAt);
            if (Number.isFinite(start) && start > now)
                return false;
            if (c.endsAt) {
                const end = Date.parse(c.endsAt);
                if (Number.isFinite(end) && end < now)
                    return false;
            }
            return true;
        });
        return active[0] ?? null;
    }
    getCompetition(id) {
        return this.competitions.find((c) => c.id === id) ?? null;
    }
    async createCompetition(input) {
        if (!this.isEnabled())
            return null;
        if (!this.adapterManager.isSupported(input.gameId)) {
            this.logger.warn(`Cannot create competition for unsupported game: ${input.gameId}`);
            return null;
        }
        const competition = {
            id: (0, crypto_1.randomUUID)(),
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
    async endCompetition(competitionId) {
        const idx = this.competitions.findIndex((c) => c.id === competitionId);
        if (idx < 0)
            return false;
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
    setDisplayName(displayName) {
        const cleaned = displayName.trim().slice(0, 24) || 'Player';
        this.displayName = cleaned;
        return cleaned;
    }
    getDisplayName() {
        return this.displayName;
    }
    setPlayerId(playerId) {
        this.playerId = playerId;
    }
    getPlayerId() {
        return this.playerId;
    }
    startGameSession(gameId) {
        const competition = this.getActiveCompetition(gameId);
        const session = {
            sessionId: (0, crypto_1.randomUUID)(),
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
    getActiveSession() {
        return this.activeSession;
    }
    async handleScoreEvent(raw) {
        if (!this.isEnabled() || !this.activeSession)
            return null;
        const session = this.activeSession;
        const sample = this.adapterManager.normalize(session.gameId, raw) ??
            this.tryNormalizeLoose(session.gameId, raw);
        if (!sample)
            return null;
        session.lastScore = sample.score;
        session.lastProgress = sample.progress ?? null;
        if (sample.event !== 'final') {
            return null;
        }
        return this.finalizeSession(sample);
    }
    tryNormalizeLoose(gameId, raw) {
        if (typeof raw !== 'object' || raw === null)
            return null;
        const record = raw;
        if (typeof record.score !== 'number')
            return null;
        return {
            gameId,
            score: Math.floor(record.score),
            event: record.event === 'final' ? 'final' : 'update',
            progress: null,
            reportedAt: new Date().toISOString()
        };
    }
    async finalizeSession(sample) {
        const session = this.activeSession;
        if (!session || session.finalized)
            return null;
        const finalSample = sample ?? {
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
        const submission = {
            id: (0, crypto_1.randomUUID)(),
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
    clearActiveSession() {
        if (this.activeSession) {
            this.validationService.clearSession(this.activeSession.sessionId);
        }
        this.activeSession = null;
    }
    getLeaderboard(competitionId, limit = 20) {
        const competition = this.getCompetition(competitionId);
        const metric = competition?.metric ?? 'high_score';
        const accepted = this.submissions.filter((s) => s.competitionId === competitionId &&
            (s.validation === 'accepted' || s.validation === 'flagged'));
        // Best score per display identity (playerId or displayName)
        const best = new Map();
        for (const s of accepted) {
            const key = s.playerId ?? `name:${s.displayName.toLowerCase()}`;
            const existing = best.get(key);
            if (!existing) {
                best.set(key, s);
                continue;
            }
            const better = metric === 'fastest_time' ? s.score < existing.score : s.score > existing.score;
            if (better)
                best.set(key, s);
        }
        const sorted = Array.from(best.values()).sort((a, b) => {
            if (metric === 'fastest_time')
                return a.score - b.score;
            // Prefer accepted over flagged when scores equal
            if (b.score !== a.score)
                return b.score - a.score;
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
    getFlaggedSubmissions(competitionId) {
        return this.submissions.filter((s) => s.validation === 'flagged' &&
            (!competitionId || s.competitionId === competitionId));
    }
    async reviewSubmission(submissionId, decision) {
        const idx = this.submissions.findIndex((s) => s.id === submissionId);
        if (idx < 0)
            return null;
        const current = this.submissions[idx];
        this.submissions[idx] = {
            ...current,
            validation: decision,
            validationReason: decision === 'accepted' ? 'admin_approved' : 'admin_rejected'
        };
        await this.saveScores();
        return this.submissions[idx];
    }
    identityKey(submission) {
        if (submission.playerId)
            return `player:${submission.playerId}`;
        return `name:${submission.displayName.toLowerCase()}`;
    }
    /**
     * Merge a remote score.
     * - Exact id / session duplicates are skipped.
     * - Same player (or display name) in the same competition: keep higher score (max-score-wins).
     * - Rejected remotes are ignored; flagged/accepted are kept.
     */
    async mergeRemoteSubmission(submission) {
        if (submission.validation === 'rejected')
            return 'skipped';
        if (this.submissions.some((s) => s.id === submission.id)) {
            return 'skipped';
        }
        if (this.submissions.some((s) => s.sessionId === submission.sessionId && s.competitionId === submission.competitionId)) {
            return 'skipped';
        }
        const competition = this.getCompetition(submission.competitionId);
        const metric = competition?.metric ?? 'high_score';
        const key = this.identityKey(submission);
        const existingIdx = this.submissions.findIndex((s) => s.competitionId === submission.competitionId &&
            this.identityKey(s) === key &&
            s.validation !== 'rejected');
        if (existingIdx >= 0) {
            const existing = this.submissions[existingIdx];
            const remoteBetter = metric === 'fastest_time'
                ? submission.score < existing.score
                : submission.score > existing.score;
            if (!remoteBetter)
                return 'skipped';
            this.submissions[existingIdx] = submission;
            await this.saveScores();
            return 'replaced';
        }
        this.submissions.push(submission);
        await this.saveScores();
        return 'inserted';
    }
    async mergeRemoteCompetition(competition) {
        const idx = this.competitions.findIndex((c) => c.id === competition.id);
        if (idx >= 0) {
            const current = this.competitions[idx];
            // Prefer ended status and later endsAt from remote when resolving conflicts
            this.competitions[idx] = {
                ...current,
                ...competition,
                status: current.status === 'ended' || competition.status === 'ended'
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
    getAllSubmissions() {
        return [...this.submissions];
    }
}
exports.CompetitionManager = CompetitionManager;
