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
  /(password|passwd|pwd|secret|token|api[_-]?key|apikey|access[_-]?key|connection[_-]?string|dsn)/i;

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
  const withoutUserInfo = value.replace(/\b([a-z][a-z0-9+.-]*:\/\/)[^@/?#\s]+@/gi, "$1[redacted]@");
  return redactKeywordCredentials(withoutUserInfo).replace(
    /([?&])([^=\s&]+)=([^&\s]+)/g,
    (match: string, prefix: string, key: string) =>
      SENSITIVE_KEYS.test(key) ? `${prefix}${key}=[redacted]` : match,
  );
}

function redactKeywordCredentials(detail: string): string {
  const assignments = /(?<![\w?&-])([\w-]+)[ \t]*=[ \t]*/g;
  const values = /'(?:\\[\s\S]|[^'\\])*(?:'|\\?$)|"(?:\\[\s\S]|[^"\\])*(?:"|\\?$)|[^\s,;&]+/y;
  let result = "";
  let copiedThrough = 0;

  for (
    let assignment = assignments.exec(detail);
    assignment;
    assignment = assignments.exec(detail)
  ) {
    if (!SENSITIVE_KEYS.test(assignment[1] ?? "")) continue;
    const valueStart = assignments.lastIndex;
    values.lastIndex = valueStart;
    if (!values.test(detail)) continue;

    result += detail.slice(copiedThrough, valueStart) + "[redacted]";
    copiedThrough = values.lastIndex;
    assignments.lastIndex = copiedThrough;
  }

  return result + detail.slice(copiedThrough);
}
