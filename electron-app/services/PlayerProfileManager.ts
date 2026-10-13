import * as fs from 'fs-extra';
import * as path from 'path';
import * as crypto from 'crypto';
import { randomUUID } from 'crypto';
import { Logger } from '../utils/Logger';
import { PlayerProfile, PublicPlayerProfile } from './competition/types';

interface ProfileStore {
  profiles: PlayerProfile[];
}

export class PlayerProfileManager {
  private readonly logger: Logger;
  private readonly profilesFile: string;
  private profiles: PlayerProfile[] = [];

  constructor() {
    this.logger = new Logger();
    this.profilesFile = path.join(process.cwd(), 'data', 'player-profiles.json');
  }

  async initialize(): Promise<void> {
    await fs.ensureDir(path.dirname(this.profilesFile));
    if (await fs.pathExists(this.profilesFile)) {
      const store = (await fs.readJson(this.profilesFile)) as ProfileStore;
      this.profiles = Array.isArray(store.profiles) ? store.profiles : [];
    } else {
      this.profiles = [];
      await this.save();
    }
    this.logger.info(`PlayerProfileManager initialized (${this.profiles.length} profiles)`);
  }

  private async save(): Promise<void> {
    await fs.writeJson(this.profilesFile, { profiles: this.profiles } satisfies ProfileStore, {
      spaces: 2
    });
  }

  private hashPin(pin: string): string {
    return crypto.createHash('sha256').update(`kioskarcade:${pin}`).digest('hex');
  }

  toPublic(profile: PlayerProfile): PublicPlayerProfile {
    return {
      id: profile.id,
      displayName: profile.displayName,
      hasPin: !!profile.pinHash,
      qrPayload: profile.qrPayload,
      createdAt: profile.createdAt,
      personalBests: { ...profile.personalBests },
      achievementIds: [...profile.achievementIds],
      tournamentHistory: [...profile.tournamentHistory],
      seasonalRank: profile.seasonalRank
    };
  }

  listProfiles(): PublicPlayerProfile[] {
    return this.profiles.map((p) => this.toPublic(p));
  }

  getProfile(playerId: string): PlayerProfile | null {
    return this.profiles.find((p) => p.id === playerId) ?? null;
  }

  getPublicProfile(playerId: string): PublicPlayerProfile | null {
    const profile = this.getProfile(playerId);
    return profile ? this.toPublic(profile) : null;
  }

  findByQrPayload(qrPayload: string): PlayerProfile | null {
    const cleaned = qrPayload.trim();
    return this.profiles.find((p) => p.qrPayload === cleaned) ?? null;
  }

  requiresPin(playerId: string): boolean {
    return !!this.getProfile(playerId)?.pinHash;
  }

  async createProfile(displayName: string, pin?: string): Promise<PublicPlayerProfile> {
    const cleanedPin = pin?.trim();
    if (cleanedPin !== undefined && cleanedPin.length > 0 && !/^\d{4,8}$/.test(cleanedPin)) {
      throw new Error('PIN must be 4–8 digits');
    }

    const id = randomUUID();
    const profile: PlayerProfile = {
      id,
      displayName: displayName.trim().slice(0, 24) || 'Player',
      pinHash: cleanedPin ? this.hashPin(cleanedPin) : null,
      qrPayload: `kioskarcade:player:${id}`,
      createdAt: new Date().toISOString(),
      personalBests: {},
      achievementIds: [],
      tournamentHistory: [],
      seasonalRank: null
    };
    this.profiles.push(profile);
    await this.save();
    return this.toPublic(profile);
  }

  /**
   * Verify PIN when the profile has one.
   * Returns false if a PIN is required but missing/wrong.
   */
  verifyPin(playerId: string, pin?: string): boolean {
    const profile = this.getProfile(playerId);
    if (!profile) return false;
    if (!profile.pinHash) return true;
    if (!pin || !pin.trim()) return false;
    return profile.pinHash === this.hashPin(pin.trim());
  }

  /**
   * Identify by QR payload or player id, enforcing PIN when set.
   */
  identify(payload: {
    readonly qrPayload?: string;
    readonly playerId?: string;
    readonly pin?: string;
  }): { readonly ok: true; readonly profile: PublicPlayerProfile } | { readonly ok: false; readonly reason: string } {
    const profile = payload.qrPayload
      ? this.findByQrPayload(payload.qrPayload)
      : payload.playerId
        ? this.getProfile(payload.playerId)
        : null;

    if (!profile) {
      return { ok: false, reason: 'not_found' };
    }
    if (!this.verifyPin(profile.id, payload.pin)) {
      if (profile.pinHash && (!payload.pin || !payload.pin.trim())) {
        return { ok: false, reason: 'pin_required' };
      }
      return { ok: false, reason: 'pin_invalid' };
    }
    return { ok: true, profile: this.toPublic(profile) };
  }

  async updatePersonalBest(playerId: string, gameId: string, score: number): Promise<boolean> {
    const idx = this.profiles.findIndex((p) => p.id === playerId);
    if (idx < 0) return false;
    const profile = this.profiles[idx];
    const current = profile.personalBests[gameId] ?? 0;
    if (score <= current) return false;
    this.profiles[idx] = {
      ...profile,
      personalBests: { ...profile.personalBests, [gameId]: score }
    };
    await this.save();
    return true;
  }

  async recordTournament(playerId: string, competitionId: string): Promise<void> {
    const idx = this.profiles.findIndex((p) => p.id === playerId);
    if (idx < 0) return;
    const profile = this.profiles[idx];
    if (profile.tournamentHistory.includes(competitionId)) return;
    this.profiles[idx] = {
      ...profile,
      tournamentHistory: [...profile.tournamentHistory, competitionId]
    };
    await this.save();
  }

  async addAchievement(playerId: string, achievementId: string): Promise<boolean> {
    const idx = this.profiles.findIndex((p) => p.id === playerId);
    if (idx < 0) return false;
    const profile = this.profiles[idx];
    if (profile.achievementIds.includes(achievementId)) return false;
    this.profiles[idx] = {
      ...profile,
      achievementIds: [...profile.achievementIds, achievementId]
    };
    await this.save();
    return true;
  }

  async setSeasonalRank(playerId: string, rank: number | null): Promise<void> {
    const idx = this.profiles.findIndex((p) => p.id === playerId);
    if (idx < 0) return;
    this.profiles[idx] = { ...this.profiles[idx], seasonalRank: rank };
    await this.save();
  }
}
