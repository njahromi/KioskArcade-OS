import * as fs from 'fs-extra';
import * as path from 'path';
import { Logger } from '../utils/Logger';
import { ConfigManager } from '../config/AppConfig';

interface AnalyticsEvent {
  readonly id: string;
  readonly timestamp: Date;
  readonly eventType: string;
  readonly category: string;
  readonly data: Record<string, any>;
  readonly sessionId: string;
  readonly userId?: string;
}

interface PerformanceMetrics {
  readonly cpuUsage: number;
  readonly memoryUsage: number;
  readonly diskUsage: number;
  readonly networkLatency: number;
  readonly gameLoadTime: number;
  readonly systemUptime: number;
}

interface UserBehavior {
  readonly sessionId: string;
  readonly startTime: Date;
  endTime?: Date; // Mutable for session updates
  gamesPlayed: string[]; // Mutable for game tracking
  totalPlayTime: number; // Mutable for play time tracking
  interactions: number; // Mutable for interaction counting
  readonly preferences: Record<string, any>;
}

interface AnalyticsSummary {
  readonly totalSessions: number;
  readonly totalPlayTime: number;
  readonly popularGames: Array<{ gameId: string; playCount: number }>;
  readonly averageSessionLength: number;
  readonly peakUsageHours: number[];
  readonly systemPerformance: PerformanceMetrics;
}

export class AnalyticsManager {
  private readonly logger: Logger;
  private readonly configManager: ConfigManager;
  private readonly analyticsDir: string;
  private readonly eventsFile: string;
  private readonly performanceFile: string;
  private readonly userBehaviorFile: string;
  private readonly events: AnalyticsEvent[] = [];
  private readonly performanceHistory: PerformanceMetrics[] = [];
  private readonly userSessions: Map<string, UserBehavior> = new Map();
  private currentSessionId: string | null = null;

  constructor() {
    this.logger = new Logger();
    this.configManager = ConfigManager.getInstance();
    this.analyticsDir = path.join(process.cwd(), 'data', 'analytics');
    this.eventsFile = path.join(this.analyticsDir, 'events.json');
    this.performanceFile = path.join(this.analyticsDir, 'performance.json');
    this.userBehaviorFile = path.join(this.analyticsDir, 'user-behavior.json');
  }

  async initialize(): Promise<void> {
    try {
      if (!this.configManager.isAnalyticsEnabled()) {
        this.logger.info('Analytics disabled, skipping initialization');
        return;
      }

      await fs.ensureDir(this.analyticsDir);
      await Promise.all([
        this.loadEvents(),
        this.loadPerformanceHistory(),
        this.loadUserSessions()
      ]);

      // Start performance monitoring
      this.startPerformanceMonitoring();
      
      this.logger.info('AnalyticsManager initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize AnalyticsManager:', error);
      throw error;
    }
  }

  private async loadEvents(): Promise<void> {
    try {
      if (await fs.pathExists(this.eventsFile)) {
        const data = await fs.readJson(this.eventsFile);
        this.events.length = 0;
        if (Array.isArray(data)) {
          this.events.push(...data);
        }
        this.logger.info(`Loaded ${this.events.length} analytics events`);
      }
    } catch (error) {
      this.logger.error('Failed to load analytics events:', error);
    }
  }

  private async loadPerformanceHistory(): Promise<void> {
    try {
      if (await fs.pathExists(this.performanceFile)) {
        const data = await fs.readJson(this.performanceFile);
        this.performanceHistory.length = 0;
        if (Array.isArray(data)) {
          this.performanceHistory.push(...data);
        }
        this.logger.info(`Loaded ${this.performanceHistory.length} performance records`);
      }
    } catch (error) {
      this.logger.error('Failed to load performance history:', error);
    }
  }

  private async loadUserSessions(): Promise<void> {
    try {
      if (await fs.pathExists(this.userBehaviorFile)) {
        const data = await fs.readJson(this.userBehaviorFile);
        this.userSessions.clear();
        if (Array.isArray(data)) {
          data.forEach((session: UserBehavior) => {
            if (session.sessionId) {
              this.userSessions.set(session.sessionId, session);
            }
          });
        }
        this.logger.info(`Loaded ${this.userSessions.size} user sessions`);
      }
    } catch (error) {
      this.logger.error('Failed to load user sessions:', error);
    }
  }

  private async saveEvents(): Promise<void> {
    try {
      await fs.writeJson(this.eventsFile, this.events, { spaces: 2 });
    } catch (error) {
      this.logger.error('Failed to save analytics events:', error);
    }
  }

  private async savePerformanceHistory(): Promise<void> {
    try {
      await fs.writeJson(this.performanceFile, this.performanceHistory, { spaces: 2 });
    } catch (error) {
      this.logger.error('Failed to save performance history:', error);
    }
  }

  private async saveUserSessions(): Promise<void> {
    try {
      const sessions = Array.from(this.userSessions.values());
      await fs.writeJson(this.userBehaviorFile, sessions, { spaces: 2 });
    } catch (error) {
      this.logger.error('Failed to save user sessions:', error);
    }
  }

  private startPerformanceMonitoring(): void {
    if (!this.configManager.getConfig().analytics.performanceMonitoring) {
      return;
    }

    setInterval(async () => {
      const metrics = await this.collectPerformanceMetrics();
      this.performanceHistory.push(metrics);
      
      // Keep only last 1000 performance records
      if (this.performanceHistory.length > 1000) {
        this.performanceHistory.splice(0, this.performanceHistory.length - 1000);
      }
      
      await this.savePerformanceHistory();
    }, 60000); // Every minute
  }

  private async collectPerformanceMetrics(): Promise<PerformanceMetrics> {
    // In a real implementation, this would collect actual system metrics
    // For now, we'll simulate the data
    return {
      cpuUsage: Math.random() * 100,
      memoryUsage: Math.random() * 100,
      diskUsage: Math.random() * 100,
      networkLatency: Math.random() * 100,
      gameLoadTime: Math.random() * 5000,
      systemUptime: Date.now()
    };
  }

  async trackEvent(eventType: string, category: string, data: Record<string, any> = {}): Promise<void> {
    if (!this.configManager.isAnalyticsEnabled()) {
      return;
    }

    const event: AnalyticsEvent = {
      id: this.generateEventId(),
      timestamp: new Date(),
      eventType,
      category,
      data,
      sessionId: this.currentSessionId || 'unknown'
    };

    this.events.push(event);
    
    // Keep only last 10000 events
    if (this.events.length > 10000) {
      this.events.splice(0, this.events.length - 10000);
    }

    await this.saveEvents();
    this.logger.info(`Analytics event tracked: ${eventType}`, event);
  }

  async startUserSession(userId?: string): Promise<string> {
    if (!this.configManager.isAnalyticsEnabled()) {
      return 'disabled';
    }

    const sessionId = this.generateSessionId();
    this.currentSessionId = sessionId;

    const session: UserBehavior = {
      sessionId,
      startTime: new Date(),
      gamesPlayed: [],
      totalPlayTime: 0,
      interactions: 0,
      preferences: {}
    };

    this.userSessions.set(sessionId, session);
    await this.saveUserSessions();

    await this.trackEvent('session_started', 'user_behavior', { sessionId, userId });
    this.logger.info(`User session started: ${sessionId}`);
    
    return sessionId;
  }

  async endUserSession(sessionId: string): Promise<void> {
    if (!this.configManager.isAnalyticsEnabled()) {
      return;
    }

    const session = this.userSessions.get(sessionId);
    if (session) {
      session.endTime = new Date();
      await this.saveUserSessions();
    }

    await this.trackEvent('session_ended', 'user_behavior', { sessionId });
    this.logger.info(`User session ended: ${sessionId}`);
  }

  async trackGamePlay(gameId: string, playTime: number): Promise<void> {
    if (!this.configManager.isAnalyticsEnabled()) {
      return;
    }

    await this.trackEvent('game_played', 'game_activity', { gameId, playTime });

    if (this.currentSessionId) {
      const session = this.userSessions.get(this.currentSessionId);
      if (session) {
        if (!session.gamesPlayed.includes(gameId)) {
          session.gamesPlayed.push(gameId);
        }
        session.totalPlayTime += playTime;
        session.interactions += 1;
        await this.saveUserSessions();
      }
    }
  }

  async getAnalyticsSummary(): Promise<AnalyticsSummary> {
    const now = new Date();
    const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    
    const recentEvents = this.events.filter(event => event.timestamp > last24Hours);
    const recentSessions = Array.from(this.userSessions.values())
      .filter(session => session.startTime > last24Hours);

    // Calculate popular games
    const gamePlayCounts = new Map<string, number>();
    recentEvents
      .filter(event => event.eventType === 'game_played')
      .forEach(event => {
        const gameId = event.data.gameId;
        gamePlayCounts.set(gameId, (gamePlayCounts.get(gameId) || 0) + 1);
      });

    const popularGames = Array.from(gamePlayCounts.entries())
      .map(([gameId, playCount]) => ({ gameId, playCount }))
      .sort((a, b) => b.playCount - a.playCount)
      .slice(0, 10);

    // Calculate average session length
    const completedSessions = recentSessions.filter(session => session.endTime);
    const averageSessionLength = completedSessions.length > 0
      ? completedSessions.reduce((total, session) => {
          const duration = session.endTime!.getTime() - session.startTime.getTime();
          return total + duration;
        }, 0) / completedSessions.length
      : 0;

    // Get latest performance metrics
    const systemPerformance = this.performanceHistory.length > 0
      ? this.performanceHistory[this.performanceHistory.length - 1]
      : await this.collectPerformanceMetrics();

    return {
      totalSessions: recentSessions.length,
      totalPlayTime: recentSessions.reduce((total, session) => total + session.totalPlayTime, 0),
      popularGames,
      averageSessionLength,
      peakUsageHours: this.calculatePeakUsageHours(recentEvents),
      systemPerformance
    };
  }

  private calculatePeakUsageHours(events: AnalyticsEvent[]): number[] {
    const hourlyActivity = new Array(24).fill(0);
    
    events.forEach(event => {
      const hour = event.timestamp.getHours();
      hourlyActivity[hour]++;
    });

    const maxActivity = Math.max(...hourlyActivity);
    return hourlyActivity
      .map((activity, hour) => ({ hour, activity }))
      .filter(({ activity }) => activity >= maxActivity * 0.8)
      .map(({ hour }) => hour);
  }

  private generateEventId(): string {
    return `evt_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  }

  private generateSessionId(): string {
    return `sess_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  }

  async exportAnalyticsData(): Promise<{
    events: AnalyticsEvent[];
    performance: PerformanceMetrics[];
    userSessions: UserBehavior[];
  }> {
    return {
      events: [...this.events],
      performance: [...this.performanceHistory],
      userSessions: Array.from(this.userSessions.values())
    };
  }

  async clearAnalyticsData(): Promise<void> {
    this.events.length = 0;
    this.performanceHistory.length = 0;
    this.userSessions.clear();
    
    await Promise.all([
      this.saveEvents(),
      this.savePerformanceHistory(),
      this.saveUserSessions()
    ]);
    
    this.logger.info('Analytics data cleared');
  }
} 