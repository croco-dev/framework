import { sql } from "drizzle-orm";
import type { DrizzleDb } from "./types";

type HealthIndicatorResult = {
  name: string;
  status: "up" | "down";
  details?: Record<string, unknown>;
};

interface HealthIndicator {
  check(): Promise<HealthIndicatorResult>;
}

export type DrizzleHealthIndicatorOptions = {
  name?: string;
};

const SENSITIVE_KEYS =
  /password|passwd|pwd|secret|token|api[_-]?key|apikey|access[_-]?key|connection[_-]?string|dsn/i;
const NEXT_KEYWORD = /[\w-]+\s*=/;
const UNQUOTED_VALUE_CHARACTER = String.raw`\\[\s\S]|[^\s\\,;&]|[,;&](?!${NEXT_KEYWORD.source})`;
const UNQUOTED_VALUE = `(?:${UNQUOTED_VALUE_CHARACTER})+`;
const SINGLE_QUOTED_VALUE = /'(?:\\[\s\S]|[^'\\])*'/;
const DOUBLE_QUOTED_PREFIX = /"(?:\\[\s\S]|[^"\\])*"/;
const KEYWORD_VALUE = [
  SINGLE_QUOTED_VALUE.source,
  `${DOUBLE_QUOTED_PREFIX.source}(?:${UNQUOTED_VALUE_CHARACTER})*`,
  UNQUOTED_VALUE,
].join("|");
const URL_OR_KEYWORD = new RegExp(
  String.raw`\b[a-z][a-z0-9+.-]*:\/\/${UNQUOTED_VALUE}|(?<![\w?&-])(([\w-]+)\s*=\s*)(?:${KEYWORD_VALUE})`,
  "gi",
);
const BARE_CREDENTIAL = new RegExp(String.raw`\b(${SENSITIVE_KEYS.source})=[^\s,;&]+`, "gi");

export class DrizzleHealthIndicator implements HealthIndicator {
  private readonly db: DrizzleDb;
  private readonly name: string;

  constructor(db: DrizzleDb, options: DrizzleHealthIndicatorOptions = {}) {
    this.db = db;
    this.name = options.name ?? "database";
  }

  async check(): Promise<HealthIndicatorResult> {
    try {
      await this.db.transaction(async (tx) => {
        await (tx as unknown as { execute: (query: unknown) => Promise<unknown> }).execute(
          sql`SELECT 1`,
        );
      });

      return {
        name: this.name,
        status: "up",
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown database error";
      return {
        name: this.name,
        status: "down",
        details: { error: redactDrizzleHealthDetail(message) },
      };
    }
  }
}

function redactDrizzleHealthDetail(value: string): string {
  return value
    .replace(/\b([a-z][a-z0-9+.-]*:\/\/)(?:[^/?#\s]+@|[^/\s]+@)/gi, "$1[redacted]@")
    .replace(URL_OR_KEYWORD, (match: string, prefix: string, key: string | undefined) =>
      key !== undefined && SENSITIVE_KEYS.test(key) ? `${prefix}[redacted]` : match,
    )
    .replace(/([?&])([^=\s&]+)=([^&\s]+)/g, (match: string, prefix: string, key: string) =>
      SENSITIVE_KEYS.test(key) ? `${prefix}${key}=[redacted]` : match,
    )
    .replace(BARE_CREDENTIAL, "$1=[redacted]");
}
