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
const LEGACY_SENSITIVE_KEY = new RegExp(String.raw`\b(?:${SENSITIVE_KEYS.source})$`, "i");
const DIAGNOSTIC_FIELDS = /^(?:detail|error|message|reason)$/i;
const ENVIRONMENT_KEY = /^(?!(?:password|sslpassword)$)[A-Za-z_][A-Za-z0-9_]*$/;
const URI_SCHEME = /[a-z][a-z0-9+.-]*:\/\//;
const URI_HOST = /(?:@?[\w.%\p{L}\p{M}\p{N}-]+|\[[\w:%.~-]+\])/u;
const URI_HOST_PORT = String.raw`${URI_HOST.source}(?::\d*)?`;
const URI_HOSTS = `${URI_HOST_PORT}(?:,(?:${URI_HOST_PORT})?)*`;
const URI_CHARACTER = /[^/ \t\r\n\v\f]/;
const URI_USERINFO_WITH_PASSWORD = String.raw`[^/?# \t\r\n\v\f:]*:${URI_CHARACTER.source}+?@`;
const AUTHORITY_BEFORE_PATH_OR_QUERY = /[^@/?# \t\r\n\v\f]*[/?#]/;
const KEYWORD_NAME = /[\w-]+/;
const KEYWORD_PADDING = /[ \t\r\n\v\f]*/;
const NEXT_KEYWORD = `${KEYWORD_NAME.source}${KEYWORD_PADDING.source}=`;
const KEYWORD_AT_VALUE_START = new RegExp(NEXT_KEYWORD, "y");
const WRAPPED_FIELD_SEPARATOR = `[,;]${NEXT_KEYWORD}`;
const SPACED_PASSWORD = String.raw`:(?=[^/?#\r\n]*[ \t])[^@/?#\r\n]*(?:@(?:(?![ \t]+${NEXT_KEYWORD})[^@/?#\r\n])*)*@`;
const WRAPPED_URI = (
  [
    [String.raw`\(`, String.raw`\)`],
    [String.raw`\[`, String.raw`\]`],
    ["<", ">"],
    ["'", "'"],
    ['"', '"'],
    ["`", "`"],
  ] as const
)
  .map(([start, end]) => {
    const boundary = String.raw`${end}[)\]>'"\x60]*(?=[,;]|\s|$)`;
    const userinfo = `(?:${URI_USERINFO_WITH_PASSWORD}|${SPACED_PASSWORD})(?=${AUTHORITY_BEFORE_PATH_OR_QUERY.source}|(?:${URI_HOSTS})?(?:[/?#]|${boundary}))`;
    return String.raw`(?<=${start})${URI_SCHEME.source}(?:${userinfo})?\S*?(?=${boundary})`;
  })
  .join("|");
const URI_AUTHORITY_END = String.raw`(?=${AUTHORITY_BEFORE_PATH_OR_QUERY.source}|(?:${URI_HOSTS})?(?:[/?#]|[,;]${NEXT_KEYWORD}|[ \t\r\n\v\f]|$))`;
const URI_USERINFO = String.raw`(${URI_SCHEME.source})(?:${SPACED_PASSWORD}${URI_AUTHORITY_END}|[^/?# \t\r\n\v\f]+?@${URI_AUTHORITY_END}|${URI_CHARACTER.source}+?@${URI_AUTHORITY_END}|${URI_CHARACTER.source}+?(?<!@)@)`;
const WRAPPED_URI_OR_USERINFO = new RegExp(`${WRAPPED_URI}|${URI_USERINFO}`, "giu");
const USERINFO = new RegExp(URI_USERINFO, "giu");
const URI_BEFORE_COMPACT_FIELD = String.raw`${URI_SCHEME.source}(?:[^/;, \t\r\n]+?@)?${URI_HOST.source}:\d+(?=${WRAPPED_FIELD_SEPARATOR})`;
const URL_OR_KEYWORD = new RegExp(
  String.raw`${WRAPPED_URI}|${URI_BEFORE_COMPACT_FIELD}|${URI_SCHEME.source}\S+|(?<![\w?&-])(${KEYWORD_NAME.source})${KEYWORD_PADDING.source}=${KEYWORD_PADDING.source}`,
  "giu",
);
const QUOTED_KEYWORD_VALUE = /'(?:\\[\s\S]|[^'\\])*'|"(?:\\[\s\S]|[^"\\])*"/y;
const UNQUOTED_KEYWORD_CHARACTER = /\\[\s\S]|[^ \t\r\n\v\f\\]/;
const UNQUOTED_KEYWORD_VALUE = new RegExp(`(?:${UNQUOTED_KEYWORD_CHARACTER.source})+`, "y");
const DELIMITED_KEYWORD_VALUE = new RegExp(
  `(?:(?![,;&]${NEXT_KEYWORD})(?:${UNQUOTED_KEYWORD_CHARACTER.source}))+`,
  "y",
);
const COMPACT_CREDENTIAL_VALUE = new RegExp(
  `(?:(?![,;](?:host|dbname|sslmode)${KEYWORD_PADDING.source}=)(?:${UNQUOTED_KEYWORD_CHARACTER.source}))+`,
  "iy",
);
const DELIMITED_FIELD = new RegExp(`[,;&]${KEYWORD_PADDING.source}${NEXT_KEYWORD}`, "y");
const DELIMITED_HOST = new RegExp(`${URI_HOSTS}[,;]${NEXT_KEYWORD}`, "uy");
const MAX_DIAGNOSTIC_DEPTH = 12;
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
    WRAPPED_URI_OR_USERINFO,
    (match: string, scheme: string | undefined) =>
      scheme === undefined ? match.replace(USERINFO, "$1[redacted]@") : `${scheme}[redacted]@`,
  );
  return redactKeywordValues(withoutUserInfo)
    .replace(/([?&])([^=\s&]+)=([^&\s]+)/g, (match: string, prefix: string, key: string) =>
      SENSITIVE_KEYS.test(key) ? `${prefix}${key}=[redacted]` : match,
    )
    .replace(BARE_CREDENTIAL, "$1=[redacted]");
}

function redactKeywordValues(detail: string, depth = 0): string {
  const tokens = new RegExp(URL_OR_KEYWORD);
  let result = "";
  let copiedThrough = 0;

  for (let token = tokens.exec(detail); token; token = tokens.exec(detail)) {
    const key = token[1];
    if (key === undefined) continue;
    const valueStart = tokens.lastIndex;
    const sensitive = SENSITIVE_KEYS.test(key);
    const diagnostic = DIAGNOSTIC_FIELDS.test(key);
    const quote = detail.charAt(valueStart);
    if (diagnostic && quote !== "'" && quote !== '"') continue;
    KEYWORD_AT_VALUE_START.lastIndex = valueStart;
    if (
      !sensitive &&
      detail.charAt(valueStart - 1) !== "=" &&
      KEYWORD_AT_VALUE_START.test(detail)
    ) {
      continue;
    }
    DELIMITED_HOST.lastIndex = valueStart;
    const compact = /[,;&]/.test(detail.charAt(token.index - 1));
    let unquoted = UNQUOTED_KEYWORD_VALUE;
    if (
      LEGACY_SENSITIVE_KEY.test(key) ||
      (key.toLowerCase() === "host" && DELIMITED_HOST.test(detail))
    ) {
      unquoted = DELIMITED_KEYWORD_VALUE;
    } else if (compact) {
      unquoted = sensitive ? COMPACT_CREDENTIAL_VALUE : DELIMITED_KEYWORD_VALUE;
    }
    const quoteMode = diagnostic
      ? "diagnostic"
      : sensitive
        ? ENVIRONMENT_KEY.test(key)
          ? "environment"
          : "connection"
        : "literal";
    const valueEnd = keywordValueEnd(detail, valueStart, unquoted, quoteMode);
    tokens.lastIndex = valueEnd;
    if (valueEnd === valueStart) continue;

    let redactedValue: string;
    if (sensitive) {
      redactedValue = "[redacted]";
    } else if (diagnostic) {
      const field = detail.slice(valueStart, valueEnd);
      const closingQuote = field.length > 1 && field.endsWith(quote) ? quote : "";
      const content = field.slice(1, closingQuote ? -1 : undefined);
      const decoded = content.replace(/\\([\\'"])/g, (match: string, escaped: string) =>
        escaped === quote || escaped === "\\" ? escaped : match,
      );
      const redacted =
        depth === MAX_DIAGNOSTIC_DEPTH ? "[redacted]" : redactKeywordValues(decoded, depth + 1);
      if (redacted === decoded) continue;
      const encoded = redacted.replace(/[\\'"]/g, (character) =>
        character === quote || character === "\\" ? "\\" + character : character,
      );
      redactedValue = quote + encoded + closingQuote;
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
  quoteMode: "diagnostic" | "environment" | "connection" | "literal",
): number {
  const first = detail.charAt(start);
  if (first === "'" || (quoteMode !== "literal" && first === '"')) {
    QUOTED_KEYWORD_VALUE.lastIndex = start;
    if (QUOTED_KEYWORD_VALUE.test(detail)) {
      start = QUOTED_KEYWORD_VALUE.lastIndex;
      if (quoteMode === "environment") {
        while (QUOTED_KEYWORD_VALUE.test(detail)) {
          start = QUOTED_KEYWORD_VALUE.lastIndex;
        }
      }
      DELIMITED_FIELD.lastIndex = start;
      if (
        quoteMode === "diagnostic" ||
        (first === "'" && quoteMode !== "environment") ||
        DELIMITED_FIELD.test(detail)
      ) {
        return start;
      }
    } else if (quoteMode !== "literal" && (first === "'" || quoteMode !== "connection")) {
      return detail.length;
    }
  }

  unquoted.lastIndex = start;
  return unquoted.test(detail) ? unquoted.lastIndex : start;
}
