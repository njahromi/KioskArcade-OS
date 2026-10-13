import * as fs from 'fs-extra';
import * as path from 'path';

import { Logger } from '../utils/Logger';

interface GameManifest {
  readonly games: GameInfo[];
  readonly lastUpdated: string;
  readonly version: string;
}

interface GameInfo {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  readonly size: number;
  readonly url: string;
  readonly checksum: string;
  readonly description: string;
  readonly thumbnail: string;
  readonly category: string;
  readonly tags: readonly string[];
}

interface LocalGameInfo extends GameInfo {
  readonly localPath: string;
  readonly lastDownloaded: string;
  readonly isInstalled: boolean;
}

export class GameManager {
  private readonly gamesDir: string;
  private readonly manifestPath: string;
  private readonly logger: Logger;
  private readonly localGames: Map<string, LocalGameInfo> = new Map();
  private remoteManifest: GameManifest | null = null;

  constructor() {
    this.logger = new Logger();
    this.gamesDir = path.join(process.cwd(), 'games');
    this.manifestPath = path.join(process.cwd(), 'data', 'local-manifest.json');
  }

  async initialize(): Promise<void> {
    try {
      // Ensure directories exist
      await Promise.all([
        fs.ensureDir(this.gamesDir),
        fs.ensureDir(path.dirname(this.manifestPath))
      ]);
      
      // Load manifests in parallel
      await Promise.all([
        this.loadLocalManifest(),
        this.loadRemoteManifest()
      ]);
      
      this.logger.info('GameManager initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize GameManager:', error);
      throw error;
    }
  }

  private async loadLocalManifest(): Promise<void> {
    try {
      if (await fs.pathExists(this.manifestPath)) {
        const manifest = await fs.readJson(this.manifestPath);
        const games = Array.isArray(manifest.games) ? manifest.games : [];
        this.localGames.clear();
        games.forEach((game: LocalGameInfo) => {
          if (game.id && game.name) {
            this.localGames.set(game.id, game);
          }
        });
        this.logger.info(`Loaded ${this.localGames.size} local games`);
      }
    } catch (error) {
      this.logger.error('Failed to load local manifest:', error);
    }
  }

  private async saveLocalManifest(): Promise<void> {
    try {
      const manifest = {
        games: Array.from(this.localGames.values()),
        lastUpdated: new Date().toISOString(),
        version: '1.0.0'
      };
      await fs.writeJson(this.manifestPath, manifest, { spaces: 2 });
    } catch (error) {
      this.logger.error('Failed to save local manifest:', error);
      throw error;
    }
  }

  private async loadRemoteManifest(): Promise<void> {
    try {
      // In a real implementation, this would fetch from a GCP bucket
      // For now, we'll use a local mock manifest
      const mockManifestPath = path.join(process.cwd(), 'manifest.json');
      
      if (await fs.pathExists(mockManifestPath)) {
        this.remoteManifest = await fs.readJson(mockManifestPath);
        this.logger.info(`Loaded remote manifest with ${this.remoteManifest?.games.length} games`);
      } else {
        // Create a mock manifest for development
        await this.createMockManifest();
      }
    } catch (error) {
      this.logger.error('Failed to load remote manifest:', error);
      await this.createMockManifest();
    }
  }

  private async createMockManifest(): Promise<void> {
    const mockManifest: GameManifest = {
      games: [
        {
          id: 'tetris',
          name: 'Tetris Classic',
          version: '1.0.0',
          size: 1024000,
          url: 'https://example.com/games/tetris.zip',
          checksum: 'abc123',
          description: 'Classic Tetris game with modern graphics',
          thumbnail: 'tetris-thumb.png',
          category: 'Puzzle',
          tags: ['puzzle', 'classic', 'single-player']
        },
        {
          id: 'snake',
          name: 'Snake Game',
          version: '1.0.0',
          size: 512000,
          url: 'https://example.com/games/snake.zip',
          checksum: 'def456',
          description: 'Classic snake game with WebGL graphics',
          thumbnail: 'snake-thumb.png',
          category: 'Arcade',
          tags: ['arcade', 'classic', 'single-player']
        },
        {
          id: 'pong',
          name: 'Pong Classic',
          version: '1.0.0',
          size: 256000,
          url: 'https://example.com/games/pong.zip',
          checksum: 'ghi789',
          description: 'Classic Pong game with modern controls',
          thumbnail: 'pong-thumb.png',
          category: 'Sports',
          tags: ['sports', 'classic', 'multiplayer']
        }
      ],
      lastUpdated: new Date().toISOString(),
      version: '1.0.0'
    };

    const mockManifestPath = path.join(process.cwd(), 'manifest.json');
    await fs.writeJson(mockManifestPath, mockManifest, { spaces: 2 });
    this.remoteManifest = mockManifest;
    
    this.logger.info('Created mock manifest');
  }

  async getGameList(): Promise<LocalGameInfo[]> {
    return Array.from(this.localGames.values());
  }

  async getGamePath(gameId: string): Promise<string | null> {
    const game = this.localGames.get(gameId);
    return game?.isInstalled ? game.localPath : null;
  }

  async syncGames(): Promise<boolean> {
    try {
      if (!this.remoteManifest) {
        throw new Error('No remote manifest available');
      }

      const updates: Promise<void>[] = [];

      for (const remoteGame of this.remoteManifest.games) {
        const localGame = this.localGames.get(remoteGame.id);
        
        if (!localGame || localGame.version !== remoteGame.version) {
          updates.push(this.downloadGame(remoteGame));
        }
      }

      await Promise.all(updates);
      await this.saveLocalManifest();
      
      this.logger.info(`Synced ${updates.length} games`);
      return true;
    } catch (error) {
      this.logger.error('Failed to sync games:', error);
      return false;
    }
  }

  private async downloadGame(gameInfo: GameInfo): Promise<void> {
    try {
      const gameDir = path.join(this.gamesDir, gameInfo.id);
      const gamePath = path.join(gameDir, 'index.html');
      
      // Create game directory
      await fs.ensureDir(gameDir);
      
      // In a real implementation, this would download from the URL
      // For now, we'll create a mock WebGL game
      await this.createMockGame(gamePath, gameInfo);
      
      // Update local game info
      const localGame: LocalGameInfo = {
        ...gameInfo,
        localPath: gamePath,
        lastDownloaded: new Date().toISOString(),
        isInstalled: true
      };
      
      this.localGames.set(gameInfo.id, localGame);
      
      this.logger.info(`Downloaded game: ${gameInfo.name}`);
    } catch (error) {
      this.logger.error(`Failed to download game ${gameInfo.id}:`, error);
      throw error;
    }
  }

  private async createMockGame(gamePath: string, gameInfo: GameInfo): Promise<void> {
    const gameHtml = this.generateMockGameHTML(gameInfo);
    await fs.writeFile(gamePath, gameHtml);
  }

  private generateMockGameHTML(gameInfo: GameInfo): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${gameInfo.name}</title>
    <style>
        body {
            margin: 0;
            padding: 0;
            background: #000;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            font-family: Arial, sans-serif;
            color: white;
            overflow: hidden;
        }
        #gameCanvas {
            border: 2px solid #333;
            background: #111;
        }
        .game-info {
            position: absolute;
            top: 10px;
            left: 10px;
            font-size: 14px;
            color: #ccc;
        }
        .hint {
            position: absolute;
            bottom: 16px;
            left: 50%;
            transform: translateX(-50%);
            font-size: 13px;
            color: #888;
        }
    </style>
</head>
<body>
    <div class="game-info">
        <div>${gameInfo.name}</div>
        <div>Version: ${gameInfo.version}</div>
        <div id="scoreLabel">Score: 0</div>
        <div id="extraLabel"></div>
    </div>
    <canvas id="gameCanvas" width="800" height="600"></canvas>
    <div class="hint">Space = score event · Esc = exit &amp; submit</div>

    <script>
        const GAME_ID = '${gameInfo.id}';
        const canvas = document.getElementById('gameCanvas');
        const ctx = canvas.getContext('2d');
        const scoreLabel = document.getElementById('scoreLabel');
        const extraLabel = document.getElementById('extraLabel');

        const gameState = {
            score: 0,
            level: 1,
            lines: 0,
            length: 3,
            isRunning: true,
            startedAt: Date.now(),
            lastReportAt: 0,
            tickAccumMs: 0,
            lastFrameAt: performance.now()
        };

        function report(event) {
            const progress = {
                level: gameState.level,
                elapsedMs: Date.now() - gameState.startedAt,
                completed: event === 'final',
                lines: gameState.lines,
                length: gameState.length
            };
            if (window.kioskArcadeGame && window.kioskArcadeGame.reportScore) {
                window.kioskArcadeGame.reportScore({
                    gameId: GAME_ID,
                    score: gameState.score,
                    event: event,
                    progress: progress
                });
            }
            gameState.lastReportAt = Date.now();
        }

        function addScore(points) {
            if (!gameState.isRunning || points <= 0) return;
            gameState.score += points;
            scoreLabel.textContent = 'Score: ' + gameState.score;
            if (Date.now() - gameState.lastReportAt > 1500) {
                report('update');
            }
        }

        function endGame() {
            if (!gameState.isRunning) return;
            gameState.isRunning = false;
            report('final');
            if (window.kioskArcadeGame && window.kioskArcadeGame.requestExit) {
                window.kioskArcadeGame.requestExit();
            }
        }

        function gameLoop(now) {
            if (!gameState.isRunning) return;
            const dt = Math.min(64, now - gameState.lastFrameAt);
            gameState.lastFrameAt = now;
            gameState.tickAccumMs += dt;

            ctx.fillStyle = '#111';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // Discrete scoring: one point pulse every ~800ms while running (not every frame).
            while (gameState.tickAccumMs >= 800) {
                gameState.tickAccumMs -= 800;
                if (GAME_ID === 'tetris') {
                    gameState.lines += 1;
                    if (gameState.lines % 10 === 0) gameState.level += 1;
                    addScore(10 * gameState.level);
                    extraLabel.textContent = 'Lines: ' + gameState.lines + '  Level: ' + gameState.level;
                } else if (GAME_ID === 'snake') {
                    gameState.length += 1;
                    addScore(5);
                    extraLabel.textContent = 'Length: ' + gameState.length;
                } else if (GAME_ID === 'pong') {
                    addScore(1);
                    extraLabel.textContent = 'Rally points';
                } else {
                    addScore(1);
                }
            }

            drawGame();
            requestAnimationFrame(gameLoop);
        }

        function drawGame() {
            switch (GAME_ID) {
                case 'tetris': drawTetris(); break;
                case 'snake': drawSnake(); break;
                case 'pong': drawPong(); break;
                default: drawGeneric();
            }
            ctx.fillStyle = '#ffffff';
            ctx.font = '20px Arial';
            ctx.fillText('Score: ' + gameState.score, 330, 40);
        }

        function drawTetris() {
            const blockSize = 20;
            const seed = Math.floor(gameState.lines / 2);
            for (let i = 0; i < 10; i++) {
                for (let j = 0; j < Math.min(20, 4 + (seed % 12)); j++) {
                    if ((i * 7 + j * 3 + seed) % 5 !== 0) {
                        ctx.fillStyle = '#00ff00';
                        ctx.fillRect(i * blockSize + 300, 500 - j * blockSize, blockSize - 1, blockSize - 1);
                    }
                }
            }
        }

        function drawSnake() {
            ctx.fillStyle = '#00ff00';
            const len = Math.min(gameState.length, 30);
            for (let i = 0; i < len; i++) {
                ctx.fillRect(200 + i * 18, 300, 16, 16);
            }
            ctx.fillStyle = '#ff0000';
            ctx.fillRect(200 + len * 18 + 20, 300, 16, 16);
        }

        function drawPong() {
            const t = (Date.now() - gameState.startedAt) / 16;
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(50, 250, 10, 100);
            ctx.fillRect(740, 250, 10, 100);
            ctx.beginPath();
            ctx.arc(400 + Math.sin(t / 40) * 200, 300 + Math.cos(t / 55) * 120, 5, 0, 2 * Math.PI);
            ctx.fill();
        }

        function drawGeneric() {
            ctx.fillStyle = '#ffffff';
            ctx.font = '24px Arial';
            ctx.fillText('${gameInfo.name}', 350, 300);
        }

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                endGame();
            } else if (e.key === ' ' || e.code === 'Space') {
                e.preventDefault();
                if (GAME_ID === 'tetris') {
                    gameState.lines += 4;
                    addScore(100 * gameState.level);
                } else if (GAME_ID === 'snake') {
                    gameState.length += 2;
                    addScore(25);
                } else {
                    addScore(10);
                }
            }
        });

        report('update');
        requestAnimationFrame(gameLoop);
    </script>
</body>
</html>`;
  }

  /** Force-regenerate installed mock HTML so score bridge updates apply. */
  async regenerateInstalledMockGames(): Promise<void> {
    for (const game of this.localGames.values()) {
      if (!game.isInstalled || !game.localPath) continue;
      const remote = this.remoteManifest?.games.find((g) => g.id === game.id);
      const info = remote ?? game;
      await this.createMockGame(game.localPath, info);
    }
  }

  async updateGame(gameId: string): Promise<boolean> {
    try {
      const remoteGame = this.remoteManifest?.games.find(g => g.id === gameId);
      if (!remoteGame) {
        throw new Error(`Game ${gameId} not found in remote manifest`);
      }

      await this.downloadGame(remoteGame);
      await this.saveLocalManifest();
      
      this.logger.info(`Updated game: ${gameId}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to update game ${gameId}:`, error);
      return false;
    }
  }

  async getGameInfo(gameId: string): Promise<LocalGameInfo | null> {
    return this.localGames.get(gameId) || null;
  }

  async isGameInstalled(gameId: string): Promise<boolean> {
    const game = this.localGames.get(gameId);
    return game?.isInstalled || false;
  }

  async getGameSize(gameId: string): Promise<number> {
    const game = this.localGames.get(gameId);
    return game?.size || 0;
  }

  async getTotalInstalledSize(): Promise<number> {
    return Array.from(this.localGames.values())
      .filter(game => game.isInstalled)
      .reduce((total, game) => total + game.size, 0);
  }
} 