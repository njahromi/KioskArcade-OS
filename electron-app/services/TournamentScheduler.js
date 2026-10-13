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
        this.onCompetitionSpawned = null;
        this.logger = new Logger_1.Logger();
        this.competitionManager = competitionManager;
        this.schedulesFile = path.join(process.cwd(), 'data', 'tournament-schedules.json');
    }
    setOnCompetitionSpawned(handler) {
        this.onCompetitionSpawned = handler;
    }
    async initialize() {
        await fs.ensureDir(path.dirname(this.schedulesFile));
        if (await fs.pathExists(this.schedulesFile)) {
            const store = (await fs.readJson(this.schedulesFile));
            this.schedules = Array.isArray(store.schedules)
                ? store.schedules.map((s) => ({
                    ...s,
                    weeklyDay: typeof s.weeklyDay === 'number' ? s.weeklyDay : 1
                }))
                : [];
        }
        else {
            this.schedules = [];
            await this.save();
        }
        this.timer = setInterval(() => {
            void this.tick();
        }, 30000);
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
            weeklyDay: schedule.weeklyDay ?? 1,
            lastSpawnedDate: schedule.lastSpawnedDate ?? null
        };
        const idx = this.schedules.findIndex((s) => s.id === next.id);
        if (idx >= 0) {
            this.schedules[idx] = {
                ...next,
                lastSpawnedDate: schedule.lastSpawnedDate ?? this.schedules[idx].lastSpawnedDate
            };
        }
        else {
            this.schedules.push(next);
        }
        await this.save();
        return this.schedules.find((s) => s.id === next.id);
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
    parseStartTime(schedule, day) {
        const [hh, mm] = schedule.startTime.split(':').map((n) => Number(n));
        if (!Number.isFinite(hh) || !Number.isFinite(mm))
            return null;
        const start = new Date(day);
        start.setHours(hh, mm, 0, 0);
        return start;
    }
    shouldSpawnToday(schedule, now) {
        if (!schedule.enabled)
            return false;
        if (schedule.lastSpawnedDate === this.localDateKey(now))
            return false;
        const start = this.parseStartTime(schedule, now);
        if (!start || now < start)
            return false;
        if (schedule.cadence === 'weekly' && now.getDay() !== schedule.weeklyDay) {
            return false;
        }
        if (schedule.cadence === 'once' && schedule.lastSpawnedDate)
            return false;
        return true;
    }
    /** Next start datetime for idle / browser countdown. */
    getUpcomingEvents(limit = 5) {
        const now = new Date();
        const events = [];
        for (const schedule of this.schedules) {
            if (!schedule.enabled)
                continue;
            const candidate = this.nextStartForSchedule(schedule, now);
            if (!candidate)
                continue;
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
    nextStartForSchedule(schedule, now) {
        if (schedule.cadence === 'once' && schedule.lastSpawnedDate) {
            return null;
        }
        if (schedule.cadence === 'weekly') {
            for (let i = 0; i < 14; i++) {
                const d = new Date(now);
                d.setDate(now.getDate() + i);
                if (d.getDay() !== schedule.weeklyDay)
                    continue;
                const start = this.parseStartTime(schedule, d);
                if (!start)
                    continue;
                if (start > now)
                    return start;
                if (i === 0 && schedule.lastSpawnedDate !== this.localDateKey(now)) {
                    // Due today but not yet marked spawned — treat as "now" for listing
                    return start;
                }
            }
            return null;
        }
        // daily
        const today = this.parseStartTime(schedule, now);
        if (!today)
            return null;
        if (today > now)
            return today;
        if (schedule.lastSpawnedDate !== this.localDateKey(now))
            return today;
        const tomorrow = new Date(now);
        tomorrow.setDate(now.getDate() + 1);
        return this.parseStartTime(schedule, tomorrow);
    }
    async tick() {
        const now = new Date();
        const spawned = [];
        for (let i = 0; i < this.schedules.length; i++) {
            const schedule = this.schedules[i];
            if (!this.shouldSpawnToday(schedule, now))
                continue;
            // Avoid duplicate active competitions for same schedule name+game while one is live
            const alreadyActive = this.competitionManager
                .listCompetitions()
                .some((c) => c.status === 'active' &&
                c.gameId === schedule.gameId &&
                c.name === schedule.name &&
                (!c.endsAt || Date.parse(c.endsAt) > Date.now()));
            if (alreadyActive) {
                this.schedules[i] = { ...schedule, lastSpawnedDate: this.localDateKey(now) };
                await this.save();
                continue;
            }
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
                spawned.push(created);
                this.onCompetitionSpawned?.(created);
                this.logger.info(`Spawned scheduled tournament ${schedule.id} → ${created.id}`);
            }
        }
        for (const c of this.competitionManager.listCompetitions()) {
            if (c.status !== 'active' || !c.endsAt)
                continue;
            if (Date.parse(c.endsAt) < Date.now()) {
                await this.competitionManager.endCompetition(c.id);
            }
        }
        return spawned;
    }
}
exports.TournamentScheduler = TournamentScheduler;
