import Redis from 'ioredis';
import { Service } from 'typedi';

@Service()
export class RedisProvider {
  private client: Redis | null = null;

  connect(url: string): void {
    this.client = new Redis(url);
  }

  getClient(): Redis {
    if (!this.client) {
      throw new Error('Redis not connected. Call connect() first.');
    }
    return this.client;
  }

  async disconnect(): Promise<void> {
    await this.client?.quit();
  }
}
