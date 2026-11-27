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
const BASELINE_SENSITIVE_KEY = new RegExp(`^(?:${SENSITIVE_KEYS.source})$`, "i");
const DIAGNOSTIC_FIELDS = /^(?:detail|error|message|reason)$/i;
const URI_SCHEME = /[a-z][a-z0-9+.-]*:\/\//;
const URL_OR_KEYWORD = new RegExp(
  String.raw`(?<=\()${URI_SCHEME.source}[^)\s]*|${URI_SCHEME.source}\S+|(?<![\w?&-])([\w-]+)\s*=\s*`,
  "gi",
);
const QUOTED_KEYWORD_VALUE = /'(?:\\[\s\S]|[^'\\])*'|"(?:\\[\s\S]|[^"\\])*"/y;
const UNQUOTED_KEYWORD_VALUE = /(?:\\[\s\S]|[^\s\\])+/y;
const DELIMITED_KEYWORD_VALUE = /(?:(?![,;&][\w-]+\s*=)(?:\\[\s\S]|[^\s\\]))+/y;
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
  const withoutUserInfo = value.replace(
    /([a-z][a-z0-9+.-]*:\/\/)(?:[^/?#\s]+(?<!@)@|[^/\s]+(?<!@)@)/gi,
    "$1[redacted]@",
  );
  return redactKeywordValues(withoutUserInfo)
    .replace(/([?&])([^=\s&]+)=([^&\s]+)/g, (match: string, prefix: string, key: string) =>
      SENSITIVE_KEYS.test(key) ? `${prefix}${key}=[redacted]` : match,
    )
    .replace(BARE_CREDENTIAL, "$1=[redacted]");
}

function redactKeywordValues(detail: string, readDiagnosticFields = true): string {
  const tokens = new RegExp(URL_OR_KEYWORD);
  let result = "";
  let copiedThrough = 0;

  for (let token = tokens.exec(detail); token; token = tokens.exec(detail)) {
    const key = token[1];
    if (key === undefined) continue;
    const valueStart = tokens.lastIndex;
    const sensitive = SENSITIVE_KEYS.test(key);
    const unquoted =
      sensitive && !BASELINE_SENSITIVE_KEY.test(key)
        ? UNQUOTED_KEYWORD_VALUE
        : DELIMITED_KEYWORD_VALUE;
    const valueEnd = keywordValueEnd(detail, valueStart, unquoted, sensitive);
    tokens.lastIndex = valueEnd;
    if (valueEnd === valueStart) continue;

    let redactedValue: string;
    if (sensitive) {
      redactedValue = "[redacted]";
    } else if (readDiagnosticFields && DIAGNOSTIC_FIELDS.test(key)) {
      const field = detail.slice(valueStart, valueEnd);
      const quote = field.charAt(0);
      redactedValue =
        (quote === "'" || quote === '"') && field.endsWith(quote)
          ? quote + redactKeywordValues(field.slice(1, -1), false) + quote
          : redactKeywordValues(field, false);
    } else {
      continue;
    }

    result += detail.slice(copiedThrough, valueStart) + redactedValue;
    copiedThrough = valueEnd;
  }

  return result + detail.slice(copiedThrough);
}

function keywordValueEnd(
  detail: string,
  start: number,
  unquoted: RegExp,
  sensitive: boolean,
): number {
  const first = detail.charAt(start);
  if (first === "'" || first === '"') {
    QUOTED_KEYWORD_VALUE.lastIndex = start;
    if (QUOTED_KEYWORD_VALUE.test(detail)) {
      start = QUOTED_KEYWORD_VALUE.lastIndex;
      if (first === "'") return start;
    } else if (sensitive) {
      return detail.length;
    }
  }

  unquoted.lastIndex = start;
  return unquoted.test(detail) ? unquoted.lastIndex : start;
}
