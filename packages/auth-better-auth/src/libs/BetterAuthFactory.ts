import { Component, Inject } from "@croco/framework-context";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import * as schema from "./schema";

export const DRIZZLE_TOKEN = "DRIZZLE_TOKEN";

type BetterAuthDatabase = Parameters<typeof drizzleAdapter>[0];

/**
 * Better Auth 초기화에 필요한 설정입니다.
 */
export interface BetterAuthConfig {
  baseURL: string; // e.g., http://localhost:3000
  secret: string; // BETTER_AUTH_SECRET
}

function createBetterAuthInstance(db: BetterAuthDatabase, config: BetterAuthConfig) {
  return betterAuth({
    database: drizzleAdapter(db, {
      provider: "pg",
      schema: schema,
    }),
    baseURL: config.baseURL,
    secret: config.secret,
  });
}

type BetterAuthInstance = ReturnType<typeof createBetterAuthInstance>;

@Component()
/**
 * Better Auth 인스턴스를 지연 생성하고 재사용하는 팩토리입니다.
 */
export class BetterAuthFactory {
  private auth: BetterAuthInstance | null = null;

  constructor(
    @Inject(DRIZZLE_TOKEN) private readonly db: BetterAuthDatabase,
    private readonly config: BetterAuthConfig,
  ) {}

  getAuth(): BetterAuthInstance {
    if (this.auth) {
      return this.auth;
    }

    this.auth = createBetterAuthInstance(this.db, this.config);

    return this.auth;
  }
}
