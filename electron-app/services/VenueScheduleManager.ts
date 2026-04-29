import { ConfigManager } from '../config/AppConfig';
import { AdminManager } from './AdminManager';

export type VenueOverride = 'none' | 'force_open';

/** Minutes since midnight [0, 1440) */
function parseHHmm(value: string): number {
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

function isNowWithinWindow(nowMinutes: number, start: number, end: number): boolean {
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
export function isOpenForSchedule(
  weeklyHours: ReadonlyArray<{ readonly start: string; readonly end: string } | null>,
  date: Date = new Date()
): boolean {
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

export class VenueScheduleManager {
  private override: VenueOverride = 'none';

  constructor(
    private readonly configManager: ConfigManager,
    private readonly adminManager: AdminManager
  ) {}

  getOverride(): VenueOverride {
    return this.override;
  }

  async setOverride(mode: VenueOverride, password: string): Promise<boolean> {
    const ok = await this.adminManager.authenticate(password);
    if (!ok) {
      return false;
    }
    this.override = mode;
    return true;
  }

  /** Whether guests may use games (hours + override; ignores health gate). */
  isVenueOpenForPublic(): boolean {
    const config = this.configManager.getConfig();
    if (!config.venue.enabled) {
      return true;
    }
    if (this.override === 'force_open') {
      return true;
    }
    return isOpenForSchedule(config.venue.weeklyHours);
  }

  getPublicStatus(): {
    readonly venueEnabled: boolean;
    readonly isOpen: boolean;
    readonly override: VenueOverride;
    readonly closedTitle: string;
    readonly closedSubtitle: string;
  } {
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
