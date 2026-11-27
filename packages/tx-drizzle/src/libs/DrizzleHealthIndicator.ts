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
const CONNECTION_URL = /\b[a-z][a-z0-9+.-]*:\/\/\S+/gi;
const UNQUOTED_VALUE_CHARACTER = /\\[\s\S]|[^\s\\]/;
const SINGLE_QUOTED_VALUE = /'(?:\\[\s\S]|[^'\\])*'/;
const DOUBLE_QUOTED_PREFIX = /"(?:\\[\s\S]|[^"\\])*"/;
const KEYWORD_VALUE = [
  SINGLE_QUOTED_VALUE.source,
  `${DOUBLE_QUOTED_PREFIX.source}(?:${UNQUOTED_VALUE_CHARACTER.source})*`,
  `(?:${UNQUOTED_VALUE_CHARACTER.source})+`,
].join("|");
const URL_OR_KEYWORD = new RegExp(
  String.raw`${CONNECTION_URL.source}|(?<![\w?&-])(([\w-]+)[ \t]*=[ \t]*)(${KEYWORD_VALUE})`,
  "gi",
);
const EMBEDDED_URL_OR_BARE_KEYWORD = new RegExp(
  String.raw`${CONNECTION_URL.source}|\b(${SENSITIVE_KEYS.source})=(?:${KEYWORD_VALUE})`,
  "gi",
);

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
    .replace(
      URL_OR_KEYWORD,
      (match: string, prefix: string, key: string | undefined, fieldValue: string) => {
        if (key === undefined) return redactUrlUserInfo(match);
        const safeValue = SENSITIVE_KEYS.test(key)
          ? "[redacted]"
          : fieldValue.replace(
              EMBEDDED_URL_OR_BARE_KEYWORD,
              (embedded: string, bareKey: string | undefined) =>
                bareKey === undefined ? redactUrlUserInfo(embedded) : `${bareKey}=[redacted]`,
            );
        return prefix + safeValue;
      },
    )
    .replace(/([?&])([^=\s&]+)=([^&\s]+)/g, (match: string, prefix: string, key: string) =>
      SENSITIVE_KEYS.test(key) ? `${prefix}${key}=[redacted]` : match,
    );
}

function redactUrlUserInfo(url: string): string {
  return url.replace(/^([a-z][a-z0-9+.-]*:\/\/)(?:[^/?#\s]+@|[^/\s]+@)/i, "$1[redacted]@");
}
