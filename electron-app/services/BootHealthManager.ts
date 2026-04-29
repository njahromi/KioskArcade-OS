import * as fs from 'fs-extra';
import * as path from 'path';
import { statfs } from 'fs/promises';

import { ConfigManager } from '../config/AppConfig';
import { Logger } from '../utils/Logger';

export interface HealthCheckResult {
  readonly diskFreeMb: number;
  readonly diskOk: boolean;
  readonly networkOk: boolean;
  readonly gamesDirOk: boolean;
  readonly networkLatencyMs: number | null;
  readonly networkError: string | null;
  readonly allPassed: boolean;
  readonly errors: readonly string[];
}

export class BootHealthManager {
  private readonly logger = new Logger();

  constructor(private readonly configManager: ConfigManager) {}

  async runChecks(): Promise<HealthCheckResult> {
    const config = this.configManager.getConfig();
    const hc = config.healthCheck;
    if (!hc.enabled) {
      return {
        diskFreeMb: 0,
        diskOk: true,
        networkOk: true,
        gamesDirOk: true,
        networkLatencyMs: null,
        networkError: null,
        allPassed: true,
        errors: []
      };
    }

    const errors: string[] = [];

    let diskFreeMb = 0;
    let diskOk = true;
    try {
      const stats = await statfs(process.cwd());
      const bsize = Number(stats.bsize);
      const bavail = Number(stats.bavail);
      diskFreeMb = (bavail * bsize) / (1024 * 1024);
      if (diskFreeMb < hc.minFreeDiskMb) {
        diskOk = false;
        errors.push(
          `Low disk space: ${diskFreeMb.toFixed(0)} MB free (minimum ${hc.minFreeDiskMb} MB)`
        );
      }
    } catch (e) {
      diskOk = false;
      const msg = e instanceof Error ? e.message : 'Unknown disk check error';
      errors.push(`Disk check failed: ${msg}`);
      this.logger.warn('Boot health disk check failed', e);
    }

    let networkOk = true;
    let networkLatencyMs: number | null = null;
    let networkError: string | null = null;
    const url =
      hc.networkCheckUrl?.trim() ||
      (config.network.analyticsEnabled ? config.analytics.endpoint : '') ||
      'https://httpbin.org/get';

    if (url) {
      const start = Date.now();
      try {
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), hc.pingTimeoutMs);
        const res = await fetch(url, { method: 'HEAD', signal: controller.signal }).catch(
          async () => fetch(url, { method: 'GET', signal: controller.signal })
        );
        clearTimeout(id);
        networkLatencyMs = Date.now() - start;
        if (!res.ok) {
          networkOk = false;
          networkError = `HTTP ${res.status}`;
          errors.push(`Network check failed: ${networkError}`);
        }
      } catch (e) {
        networkOk = false;
        networkError = e instanceof Error ? e.message : 'Network error';
        errors.push(`Network check failed: ${networkError}`);
      }
    }

    const games = await this.ensureGamesDirReadable();
    if (!games.ok) {
      errors.push(`Games directory: ${games.error ?? 'not readable'}`);
    }

    const allPassed = diskOk && networkOk && games.ok;
    return {
      diskFreeMb,
      diskOk,
      networkOk,
      gamesDirOk: games.ok,
      networkLatencyMs,
      networkError,
      allPassed,
      errors
    };
  }

  async ensureGamesDirReadable(): Promise<{ readonly ok: boolean; readonly error: string | null }> {
    const gamesDir = path.join(process.cwd(), 'games');
    try {
      await fs.access(gamesDir, fs.constants.R_OK);
      return { ok: true, error: null };
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Cannot read games directory';
      return { ok: false, error: msg };
    }
  }
}
