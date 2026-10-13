import * as fs from 'fs-extra';
import * as path from 'path';
import * as crypto from 'crypto';
import { randomUUID } from 'crypto';
import { Logger } from '../utils/Logger';
import { PlayerProfile } from './competition/types';

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

  listProfiles(): PlayerProfile[] {
    return [...this.profiles];
  }

  getProfile(playerId: string): PlayerProfile | null {
    return this.profiles.find((p) => p.id === playerId) ?? null;
  }

  findByQrPayload(qrPayload: string): PlayerProfile | null {
    return this.profiles.find((p) => p.qrPayload === qrPayload) ?? null;
  }

  async createProfile(displayName: string, pin?: string): Promise<PlayerProfile> {
    const id = randomUUID();
    const profile: PlayerProfile = {
      id,
      displayName: displayName.trim().slice(0, 24) || 'Player',
      pinHash: pin ? this.hashPin(pin) : null,
      qrPayload: `kioskarcade:player:${id}`,
      createdAt: new Date().toISOString(),
      personalBests: {},
      achievementIds: [],
      tournamentHistory: [],
      seasonalRank: null
    };
    this.profiles.push(profile);
    await this.save();
    return profile;
  }

  verifyPin(playerId: string, pin: string): boolean {
    const profile = this.getProfile(playerId);
    if (!profile?.pinHash) return true;
    return profile.pinHash === this.hashPin(pin);
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
