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
exports.TournamentScheduler = void 0;
const fs = __importStar(require("fs-extra"));
const path = __importStar(require("path"));
const Logger_1 = require("../utils/Logger");
class TournamentScheduler {
    constructor(competitionManager) {
        this.schedules = [];
        this.timer = null;
        this.logger = new Logger_1.Logger();
        this.competitionManager = competitionManager;
        this.schedulesFile = path.join(process.cwd(), 'data', 'tournament-schedules.json');
    }
    async initialize() {
        await fs.ensureDir(path.dirname(this.schedulesFile));
        if (await fs.pathExists(this.schedulesFile)) {
            const store = (await fs.readJson(this.schedulesFile));
            this.schedules = Array.isArray(store.schedules) ? store.schedules : [];
        }
        else {
            this.schedules = [];
            await this.save();
        }
        this.timer = setInterval(() => {
            void this.tick();
        }, 60000);
        await this.tick();
        this.logger.info(`TournamentScheduler initialized (${this.schedules.length} schedules)`);
    }
    stop() {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
    }
    async save() {
        await fs.writeJson(this.schedulesFile, { schedules: this.schedules }, {
            spaces: 2
        });
    }
    listSchedules() {
        return [...this.schedules];
    }
    async upsertSchedule(schedule) {
        const next = {
            ...schedule,
            lastSpawnedDate: schedule.lastSpawnedDate ?? null
        };
        const idx = this.schedules.findIndex((s) => s.id === next.id);
        if (idx >= 0) {
            this.schedules[idx] = next;
        }
        else {
            this.schedules.push(next);
        }
        await this.save();
        return next;
    }
    async removeSchedule(id) {
        const before = this.schedules.length;
        this.schedules = this.schedules.filter((s) => s.id !== id);
        if (this.schedules.length === before)
            return false;
        await this.save();
        return true;
    }
    localDateKey(d = new Date()) {
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }
    shouldSpawnToday(schedule, now) {
        if (!schedule.enabled)
            return false;
        if (schedule.lastSpawnedDate === this.localDateKey(now))
            return false;
        const [hh, mm] = schedule.startTime.split(':').map((n) => Number(n));
        if (!Number.isFinite(hh) || !Number.isFinite(mm))
            return false;
        const start = new Date(now);
        start.setHours(hh, mm, 0, 0);
        if (now < start)
            return false;
        if (schedule.cadence === 'weekly' && now.getDay() !== 1) {
            // Spawn weekly championships on Mondays by default
            return false;
        }
        if (schedule.cadence === 'once' && schedule.lastSpawnedDate)
            return false;
        return true;
    }
    async tick() {
        const now = new Date();
        for (let i = 0; i < this.schedules.length; i++) {
            const schedule = this.schedules[i];
            if (!this.shouldSpawnToday(schedule, now))
                continue;
            const endsAt = new Date(now.getTime() + schedule.durationMinutes * 60000).toISOString();
            const input = {
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
            if (c.status !== 'active' || !c.endsAt)
                continue;
            if (Date.parse(c.endsAt) < Date.now()) {
                await this.competitionManager.endCompetition(c.id);
            }
        }
    }
}
exports.TournamentScheduler = TournamentScheduler;
