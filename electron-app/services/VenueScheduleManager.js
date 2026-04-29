"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VenueScheduleManager = void 0;
exports.isOpenForSchedule = isOpenForSchedule;
/** Minutes since midnight [0, 1440) */
function parseHHmm(value) {
    const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
    if (!match) {
        throw new Error(`Invalid time format (expected HH:mm): ${value}`);
    }
    const h = Number(match[1]);
    const m = Number(match[2]);
    if (h > 23 || m > 59) {
        throw new Error(`Invalid time: ${value}`);
    }
    return h * 60 + m;
}
function isNowWithinWindow(nowMinutes, start, end) {
    if (start < end) {
        return nowMinutes >= start && nowMinutes < end;
    }
    if (start > end) {
        return nowMinutes >= start || nowMinutes < end;
    }
    return false;
}
/**
 * JavaScript weekday: 0 = Sunday … 6 = Saturday.
 * `weeklyHours[0]` is Sunday.
 */
function isOpenForSchedule(weeklyHours, date = new Date()) {
    const day = date.getDay();
    const slot = weeklyHours[day];
    if (!slot) {
        return false;
    }
    const start = parseHHmm(slot.start);
    const end = parseHHmm(slot.end);
    const nowMinutes = date.getHours() * 60 + date.getMinutes();
    return isNowWithinWindow(nowMinutes, start, end);
}
class VenueScheduleManager {
    constructor(configManager, adminManager) {
        this.configManager = configManager;
        this.adminManager = adminManager;
        this.override = 'none';
    }
    getOverride() {
        return this.override;
    }
    async setOverride(mode, password) {
        const ok = await this.adminManager.authenticate(password);
        if (!ok) {
            return false;
        }
        this.override = mode;
        return true;
    }
    /** Whether guests may use games (hours + override; ignores health gate). */
    isVenueOpenForPublic() {
        const config = this.configManager.getConfig();
        if (!config.venue.enabled) {
            return true;
        }
        if (this.override === 'force_open') {
            return true;
        }
        return isOpenForSchedule(config.venue.weeklyHours);
    }
    getPublicStatus() {
        const config = this.configManager.getConfig();
        const venue = config.venue;
        const isOpen = this.isVenueOpenForPublic();
        return {
            venueEnabled: venue.enabled,
            isOpen,
            override: this.override,
            closedTitle: venue.closedTitle,
            closedSubtitle: venue.closedSubtitle
        };
    }
}
exports.VenueScheduleManager = VenueScheduleManager;
