import express from 'express';
import * as fs from 'fs-extra';
import * as path from 'path';
import { Logger } from '../electron-app/utils/Logger';

interface ArcadeUnit {
  id: string;
  locationId: string;
  locationName: string;
  status: 'pending' | 'active' | 'suspended' | 'deactivated';
  activationDate: string;
  lastHeartbeat: string;
  posId: string;
  revenue: number;
  gamesPlayed: number;
  uptime: number; // hours
}

interface POSTransaction {
  id: string;
  arcadeId: string;
  amount: number;
  currency: string;
  timestamp: string;
  type: 'credit' | 'debit' | 'refund';
  description: string;
}

class MockPOSServer {
  private app: express.Application;
  private logger: Logger;
  private arcadeUnits: Map<string, ArcadeUnit> = new Map();
  private transactions: POSTransaction[] = [];
  private readonly dataDir: string;

  constructor() {
    this.app = express();
    this.logger = new Logger();
    this.dataDir = path.join(process.cwd(), 'data', 'pos-simulator');
    
    this.setupMiddleware();
    this.setupRoutes();
    this.loadData();
  }

  private setupMiddleware(): void {
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true }));
    
    // CORS for development
    this.app.use((req, res, next) => {
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
      if (req.method === 'OPTIONS') {
        res.sendStatus(200);
      } else {
        next();
      }
    });
  }

  private setupRoutes(): void {
    // Health check
    this.app.get('/health', (req, res) => {
      res.json({ status: 'healthy', timestamp: new Date().toISOString() });
    });

    // Register arcade unit
    this.app.post('/arcade/register', (req, res) => {
      const { arcadeId, locationId, locationName } = req.body;
      
      if (!arcadeId || !locationId || !locationName) {
        return res.status(400).json({ error: 'arcadeId, locationId, and locationName are required' });
      }

      if (this.arcadeUnits.has(arcadeId)) {
        return res.status(409).json({ error: 'Arcade unit already registered' });
      }

      const arcadeUnit: ArcadeUnit = {
        id: arcadeId,
        locationId,
        locationName,
        status: 'pending',
        activationDate: new Date().toISOString(),
        lastHeartbeat: new Date().toISOString(),
        posId: `POS_${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
        revenue: 0,
        gamesPlayed: 0,
        uptime: 0
      };

      this.arcadeUnits.set(arcadeId, arcadeUnit);
      this.saveData();

      this.logger.info(`Arcade unit registered: ${arcadeId} at ${locationName}`);
      res.status(201).json(arcadeUnit);
    });

    // Activate arcade unit
    this.app.post('/arcade/:arcadeId/activate', (req, res) => {
      const { arcadeId } = req.params;
      const { posId, activationCode } = req.body;

      if (!this.arcadeUnits.has(arcadeId)) {
        return res.status(404).json({ error: 'Arcade unit not found' });
      }

      const arcadeUnit = this.arcadeUnits.get(arcadeId)!;
      
      // Simulate activation code validation
      if (activationCode !== 'ACTIVATE123') {
        return res.status(400).json({ error: 'Invalid activation code' });
      }

      arcadeUnit.status = 'active';
      arcadeUnit.posId = posId || arcadeUnit.posId;
      arcadeUnit.activationDate = new Date().toISOString();
      arcadeUnit.lastHeartbeat = new Date().toISOString();

      this.saveData();

      this.logger.info(`Arcade unit activated: ${arcadeId}`);
      res.json(arcadeUnit);
    });

    // Get arcade unit status
    this.app.get('/arcade/:arcadeId/status', (req, res) => {
      const { arcadeId } = req.params;

      if (!this.arcadeUnits.has(arcadeId)) {
        return res.status(404).json({ error: 'Arcade unit not found' });
      }

      const arcadeUnit = this.arcadeUnits.get(arcadeId)!;
      res.json(arcadeUnit);
    });

    // Heartbeat from arcade unit
    this.app.post('/arcade/:arcadeId/heartbeat', (req, res) => {
      const { arcadeId } = req.params;
      const { gamesPlayed, revenue, uptime } = req.body;

      if (!this.arcadeUnits.has(arcadeId)) {
        return res.status(404).json({ error: 'Arcade unit not found' });
      }

      const arcadeUnit = this.arcadeUnits.get(arcadeId)!;
      arcadeUnit.lastHeartbeat = new Date().toISOString();
      
      if (gamesPlayed !== undefined) arcadeUnit.gamesPlayed = gamesPlayed;
      if (revenue !== undefined) arcadeUnit.revenue = revenue;
      if (uptime !== undefined) arcadeUnit.uptime = uptime;

      this.saveData();

      res.json({ status: 'ok', timestamp: new Date().toISOString() });
    });

    // Process payment
    this.app.post('/payment/process', (req, res) => {
      const { arcadeId, amount, currency = 'USD', description } = req.body;

      if (!arcadeId || !amount) {
        return res.status(400).json({ error: 'arcadeId and amount are required' });
      }

      if (!this.arcadeUnits.has(arcadeId)) {
        return res.status(404).json({ error: 'Arcade unit not found' });
      }

      const arcadeUnit = this.arcadeUnits.get(arcadeId)!;
      
      if (arcadeUnit.status !== 'active') {
        return res.status(400).json({ error: 'Arcade unit is not active' });
      }

      const transaction: POSTransaction = {
        id: this.generateTransactionId(),
        arcadeId,
        amount,
        currency,
        timestamp: new Date().toISOString(),
        type: 'credit',
        description: description || 'Game credit purchase'
      };

      this.transactions.push(transaction);
      arcadeUnit.revenue += amount;
      this.saveData();

      this.logger.info(`Payment processed: ${amount} ${currency} for ${arcadeId}`);
      res.json({
        transactionId: transaction.id,
        status: 'approved',
        timestamp: transaction.timestamp
      });
    });

    // Get transaction history
    this.app.get('/transactions/:arcadeId', (req, res) => {
      const { arcadeId } = req.params;
      const { limit = 50, offset = 0 } = req.query;

      const arcadeTransactions = this.transactions
        .filter(t => t.arcadeId === arcadeId)
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(parseInt(offset as string), parseInt(offset as string) + parseInt(limit as string));

      res.json({
        transactions: arcadeTransactions,
        total: this.transactions.filter(t => t.arcadeId === arcadeId).length
      });
    });

    // Get revenue report
    this.app.get('/reports/revenue', (req, res) => {
      const { startDate, endDate, arcadeId } = req.query;

      let filteredTransactions = this.transactions;

      if (startDate) {
        filteredTransactions = filteredTransactions.filter(t => 
          new Date(t.timestamp) >= new Date(startDate as string)
        );
      }

      if (endDate) {
        filteredTransactions = filteredTransactions.filter(t => 
          new Date(t.timestamp) <= new Date(endDate as string)
        );
      }

      if (arcadeId) {
        filteredTransactions = filteredTransactions.filter(t => t.arcadeId === arcadeId);
      }

      const totalRevenue = filteredTransactions.reduce((sum, t) => sum + t.amount, 0);
      const transactionCount = filteredTransactions.length;

      res.json({
        totalRevenue,
        transactionCount,
        period: { startDate, endDate },
        transactions: filteredTransactions
      });
    });

    // Suspend arcade unit
    this.app.post('/arcade/:arcadeId/suspend', (req, res) => {
      const { arcadeId } = req.params;
      const { reason } = req.body;

      if (!this.arcadeUnits.has(arcadeId)) {
        return res.status(404).json({ error: 'Arcade unit not found' });
      }

      const arcadeUnit = this.arcadeUnits.get(arcadeId)!;
      arcadeUnit.status = 'suspended';

      this.saveData();

      this.logger.info(`Arcade unit suspended: ${arcadeId}`, { reason });
      res.json(arcadeUnit);
    });

    // Reactivate arcade unit
    this.app.post('/arcade/:arcadeId/reactivate', (req, res) => {
      const { arcadeId } = req.params;

      if (!this.arcadeUnits.has(arcadeId)) {
        return res.status(404).json({ error: 'Arcade unit not found' });
      }

      const arcadeUnit = this.arcadeUnits.get(arcadeId)!;
      arcadeUnit.status = 'active';
      arcadeUnit.lastHeartbeat = new Date().toISOString();

      this.saveData();

      this.logger.info(`Arcade unit reactivated: ${arcadeId}`);
      res.json(arcadeUnit);
    });

    // Get all arcade units (for admin)
    this.app.get('/arcade', (req, res) => {
      const arcadeUnits = Array.from(this.arcadeUnits.values());
      res.json({ arcadeUnits });
    });

    // Clear data (for testing)
    this.app.delete('/data', (req, res) => {
      this.arcadeUnits.clear();
      this.transactions = [];
      this.saveData();
      
      this.logger.info('All POS data cleared');
      res.json({ message: 'Data cleared successfully' });
    });
  }

  private generateTransactionId(): string {
    return 'TXN_' + Math.random().toString(36).substring(2, 15).toUpperCase();
  }

  private async loadData(): Promise<void> {
    try {
      await fs.ensureDir(this.dataDir);
      const dataFile = path.join(this.dataDir, 'pos-data.json');
      
      if (await fs.pathExists(dataFile)) {
        const data = await fs.readJson(dataFile);
        this.arcadeUnits = new Map(Object.entries(data.arcadeUnits || {}));
        this.transactions = data.transactions || [];
        this.logger.info(`Loaded ${this.arcadeUnits.size} arcade units and ${this.transactions.length} transactions`);
      }
    } catch (error) {
      this.logger.error('Failed to load POS data:', error);
    }
  }

  private async saveData(): Promise<void> {
    try {
      const dataFile = path.join(this.dataDir, 'pos-data.json');
      const data = {
        arcadeUnits: Object.fromEntries(this.arcadeUnits),
        transactions: this.transactions
      };
      await fs.writeJson(dataFile, data, { spaces: 2 });
    } catch (error) {
      this.logger.error('Failed to save POS data:', error);
    }
  }

  async start(port: number = 8086): Promise<void> {
    return new Promise((resolve) => {
      this.app.listen(port, () => {
        this.logger.info(`Mock POS server started on port ${port}`);
        this.logger.info(`Health check: http://localhost:${port}/health`);
        this.logger.info(`Arcade units: http://localhost:${port}/arcade`);
        resolve();
      });
    });
  }

  async stop(): Promise<void> {
    this.logger.info('Mock POS server stopped');
  }
}

// Start server if run directly
if (require.main === module) {
  const server = new MockPOSServer();
  const port = parseInt(process.env.PORT || '8086');
  
  server.start(port).catch(error => {
    console.error('Failed to start mock POS server:', error);
    process.exit(1);
  });
}

export { MockPOSServer }; 