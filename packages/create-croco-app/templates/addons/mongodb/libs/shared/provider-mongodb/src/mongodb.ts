import { type Db, MongoClient } from "mongodb";
import { Service } from "typedi";

@Service()
export class MongoDbProvider {
  private client: MongoClient | null = null;
  private db: Db | null = null;

  async connect(uri: string, dbName: string): Promise<void> {
    this.client = new MongoClient(uri);
    await this.client.connect();
    this.db = this.client.db(dbName);
  }

  getDb(): Db {
    if (!this.db) {
      throw new Error("MongoDB not connected. Call connect() first.");
    }
    return this.db;
  }

  async disconnect(): Promise<void> {
    await this.client?.close();
  }
}
