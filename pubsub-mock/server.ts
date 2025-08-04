import express from 'express';
import * as fs from 'fs-extra';
import * as path from 'path';
import { Logger } from '../electron-app/utils/Logger';

interface PubSubMessage {
  id: string;
  data: any;
  attributes: Record<string, string>;
  publishTime: string;
}

interface Topic {
  name: string;
  messages: PubSubMessage[];
  subscribers: string[];
}

class MockPubSubServer {
  private app: express.Application;
  private logger: Logger;
  private topics: Map<string, Topic> = new Map();
  private readonly dataDir: string;

  constructor() {
    this.app = express();
    this.logger = new Logger();
    this.dataDir = path.join(process.cwd(), 'data', 'pubsub-mock');
    
    this.setupMiddleware();
    this.setupRoutes();
    this.loadTopics();
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

    // List topics
    this.app.get('/topics', (req, res) => {
      const topicList = Array.from(this.topics.keys());
      res.json({ topics: topicList });
    });

    // Create topic
    this.app.post('/topics', (req, res) => {
      const { name } = req.body;
      
      if (!name) {
        return res.status(400).json({ error: 'Topic name is required' });
      }

      if (this.topics.has(name)) {
        return res.status(409).json({ error: 'Topic already exists' });
      }

      this.topics.set(name, {
        name,
        messages: [],
        subscribers: []
      });

      this.saveTopics();
      this.logger.info(`Topic created: ${name}`);
      res.status(201).json({ name });
    });

    // Publish message
    this.app.post('/topics/:topic/publish', (req, res) => {
      const { topic } = req.params;
      const { data, attributes = {} } = req.body;

      if (!this.topics.has(topic)) {
        return res.status(404).json({ error: 'Topic not found' });
      }

      const topicObj = this.topics.get(topic)!;
      const message: PubSubMessage = {
        id: this.generateMessageId(),
        data,
        attributes,
        publishTime: new Date().toISOString()
      };

      topicObj.messages.push(message);
      this.saveTopics();

      this.logger.info(`Message published to topic ${topic}`, { messageId: message.id });
      res.json({ messageIds: [message.id] });
    });

    // Pull messages
    this.app.post('/subscriptions/:subscription/pull', (req, res) => {
      const { subscription } = req.params;
      const { maxMessages = 10 } = req.body;

      // Find topic by subscription name
      const topic = Array.from(this.topics.values()).find(t => 
        t.subscribers.includes(subscription)
      );

      if (!topic) {
        return res.status(404).json({ error: 'Subscription not found' });
      }

      const messages = topic.messages.slice(0, maxMessages);
      
      // Remove pulled messages
      topic.messages.splice(0, messages.length);
      this.saveTopics();

      res.json({
        receivedMessages: messages.map(msg => ({
          ackId: msg.id,
          message: msg
        }))
      });
    });

    // Acknowledge messages
    this.app.post('/subscriptions/:subscription/acknowledge', (req, res) => {
      const { ackIds } = req.body;
      
      if (!Array.isArray(ackIds)) {
        return res.status(400).json({ error: 'ackIds must be an array' });
      }

      this.logger.info(`Messages acknowledged: ${ackIds.length} messages`);
      res.json({});
    });

    // Create subscription
    this.app.post('/subscriptions', (req, res) => {
      const { name, topic } = req.body;

      if (!name || !topic) {
        return res.status(400).json({ error: 'Subscription name and topic are required' });
      }

      if (!this.topics.has(topic)) {
        return res.status(404).json({ error: 'Topic not found' });
      }

      const topicObj = this.topics.get(topic)!;
      if (topicObj.subscribers.includes(name)) {
        return res.status(409).json({ error: 'Subscription already exists' });
      }

      topicObj.subscribers.push(name);
      this.saveTopics();

      this.logger.info(`Subscription created: ${name} for topic ${topic}`);
      res.status(201).json({ name, topic });
    });

    // Get topic messages (for debugging)
    this.app.get('/topics/:topic/messages', (req, res) => {
      const { topic } = req.params;
      
      if (!this.topics.has(topic)) {
        return res.status(404).json({ error: 'Topic not found' });
      }

      const topicObj = this.topics.get(topic)!;
      res.json({ messages: topicObj.messages });
    });

    // Clear topic messages (for debugging)
    this.app.delete('/topics/:topic/messages', (req, res) => {
      const { topic } = req.params;
      
      if (!this.topics.has(topic)) {
        return res.status(404).json({ error: 'Topic not found' });
      }

      const topicObj = this.topics.get(topic)!;
      topicObj.messages = [];
      this.saveTopics();

      this.logger.info(`Messages cleared for topic: ${topic}`);
      res.json({});
    });
  }

  private generateMessageId(): string {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  }

  private async loadTopics(): Promise<void> {
    try {
      await fs.ensureDir(this.dataDir);
      const topicsFile = path.join(this.dataDir, 'topics.json');
      
      if (await fs.pathExists(topicsFile)) {
        const data = await fs.readJson(topicsFile);
        this.topics = new Map(Object.entries(data));
        this.logger.info(`Loaded ${this.topics.size} topics from storage`);
      } else {
        // Create default topics
        this.createDefaultTopics();
      }
    } catch (error) {
      this.logger.error('Failed to load topics:', error);
      this.createDefaultTopics();
    }
  }

  private createDefaultTopics(): void {
    const defaultTopics = [
      'arcade-tokens',
      'arcade-status',
      'game-updates',
      'admin-notifications'
    ];

    defaultTopics.forEach(topicName => {
      this.topics.set(topicName, {
        name: topicName,
        messages: [],
        subscribers: []
      });
    });

    this.saveTopics();
    this.logger.info('Created default topics');
  }

  private async saveTopics(): Promise<void> {
    try {
      const topicsFile = path.join(this.dataDir, 'topics.json');
      const topicsData = Object.fromEntries(this.topics);
      await fs.writeJson(topicsFile, topicsData, { spaces: 2 });
    } catch (error) {
      this.logger.error('Failed to save topics:', error);
    }
  }

  async start(port: number = 8085): Promise<void> {
    return new Promise((resolve) => {
      this.app.listen(port, () => {
        this.logger.info(`Mock Pub/Sub server started on port ${port}`);
        this.logger.info(`Health check: http://localhost:${port}/health`);
        this.logger.info(`Topics: http://localhost:${port}/topics`);
        resolve();
      });
    });
  }

  async stop(): Promise<void> {
    // In a real implementation, this would close the server
    this.logger.info('Mock Pub/Sub server stopped');
  }
}

// Start server if run directly
if (require.main === module) {
  const server = new MockPubSubServer();
  const port = parseInt(process.env.PORT || '8085');
  
  server.start(port).catch(error => {
    console.error('Failed to start mock Pub/Sub server:', error);
    process.exit(1);
  });
}

export { MockPubSubServer }; 