import * as fs from 'fs-extra';
import * as path from 'path';
import * as crypto from 'crypto';
import fetch from 'node-fetch';
import { Logger } from '../utils/Logger';

interface GameManifest {
  games: GameInfo[];
  lastUpdated: string;
  version: string;
}

interface GameInfo {
  id: string;
  name: string;
  version: string;
  size: number;
  url: string;
  checksum: string;
  description: string;
  thumbnail: string;
  category: string;
  tags: string[];
}

interface LocalGameInfo extends GameInfo {
  localPath: string;
  lastDownloaded: string;
  isInstalled: boolean;
}

export class GameManager {
  private readonly gamesDir: string;
  private readonly manifestPath: string;
  private readonly logger: Logger;
  private localGames: Map<string, LocalGameInfo> = new Map();
  private remoteManifest: GameManifest | null = null;

  constructor() {
    this.logger = new Logger();
    this.gamesDir = path.join(process.cwd(), 'games');
    this.manifestPath = path.join(process.cwd(), 'data', 'local-manifest.json');
  }

  async initialize(): Promise<void> {
    try {
      // Ensure directories exist
      await fs.ensureDir(this.gamesDir);
      await fs.ensureDir(path.dirname(this.manifestPath));
      
      // Load local manifest
      await this.loadLocalManifest();
      
      // Load remote manifest
      await this.loadRemoteManifest();
      
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
        this.localGames = new Map(manifest.games.map((game: LocalGameInfo) => [game.id, game]));
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
    if (game && game.isInstalled) {
      return game.localPath;
    }
    return null;
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
    </style>
</head>
<body>
    <div class="game-info">
        <div>${gameInfo.name}</div>
        <div>Version: ${gameInfo.version}</div>
        <div>Category: ${gameInfo.category}</div>
    </div>
    <canvas id="gameCanvas" width="800" height="600"></canvas>
    
    <script>
        // Mock WebGL game implementation
        const canvas = document.getElementById('gameCanvas');
        const ctx = canvas.getContext('2d');
        
        let gameState = {
            score: 0,
            level: 1,
            isRunning: true
        };
        
        // Game loop
        function gameLoop() {
            if (!gameState.isRunning) return;
            
            // Clear canvas
            ctx.fillStyle = '#111';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            
            // Draw game elements based on game type
            drawGame();
            
            // Update score
            gameState.score += 1;
            
            requestAnimationFrame(gameLoop);
        }
        
        function drawGame() {
            const gameId = '${gameInfo.id}';
            
            switch(gameId) {
                case 'tetris':
                    drawTetris();
                    break;
                case 'snake':
                    drawSnake();
                    break;
                case 'pong':
                    drawPong();
                    break;
                default:
                    drawGeneric();
            }
        }
        
        function drawTetris() {
            // Draw tetris blocks
            const blockSize = 20;
            for (let i = 0; i < 10; i++) {
                for (let j = 0; j < 20; j++) {
                    if (Math.random() > 0.7) {
                        ctx.fillStyle = '#00ff00';
                        ctx.fillRect(i * blockSize + 300, j * blockSize + 100, blockSize - 1, blockSize - 1);
                    }
                }
            }
        }
        
        function drawSnake() {
            // Draw snake
            ctx.fillStyle = '#00ff00';
            for (let i = 0; i < 10; i++) {
                ctx.fillRect(400 + i * 20, 300, 18, 18);
            }
            
            // Draw food
            ctx.fillStyle = '#ff0000';
            ctx.fillRect(600, 300, 18, 18);
        }
        
        function drawPong() {
            // Draw paddles
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(50, 250, 10, 100);
            ctx.fillRect(740, 250, 10, 100);
            
            // Draw ball
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(400, 300, 5, 0, 2 * Math.PI);
            ctx.fill();
        }
        
        function drawGeneric() {
            // Draw generic game elements
            ctx.fillStyle = '#ffffff';
            ctx.font = '24px Arial';
            ctx.fillText('${gameInfo.name}', 350, 300);
            ctx.font = '16px Arial';
            ctx.fillText('Score: ' + gameState.score, 350, 330);
        }
        
        // Start game
        gameLoop();
        
        // Handle keyboard input
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                gameState.isRunning = false;
                // In a real implementation, this would return to the arcade menu
            }
        });
    </script>
</body>
</html>`;
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
    let totalSize = 0;
    for (const game of this.localGames.values()) {
      if (game.isInstalled) {
        totalSize += game.size;
      }
    }
    return totalSize;
  }
} 