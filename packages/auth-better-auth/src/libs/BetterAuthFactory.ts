import { Component, Inject } from '@croco/framework-context';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import * as schema from './schema';

export const DRIZZLE_TOKEN = 'DRIZZLE_TOKEN';

type BetterAuthDatabase = Parameters<typeof drizzleAdapter>[0];

export interface BetterAuthConfig {
  baseURL: string; // e.g., http://localhost:3000
  secret: string; // BETTER_AUTH_SECRET
}

@Component()
export class BetterAuthFactory {
  private auth: ReturnType<typeof betterAuth>;

  constructor(
    @Inject(DRIZZLE_TOKEN) private readonly db: BetterAuthDatabase,
    config: BetterAuthConfig
  ) {
    this.auth = betterAuth({
      database: drizzleAdapter(this.db, {
        provider: 'pg',
        schema: schema,
      }),
      baseURL: config.baseURL,
      secret: config.secret,
    });
  }

  getAuth() {
    return this.auth;
  }
}
