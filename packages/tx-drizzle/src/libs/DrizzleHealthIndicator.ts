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
const ENVIRONMENT_KEY = /^(?:PGPASSWORD|[A-Z][A-Z0-9]*_[A-Z0-9_]+)$/;
const URI_SCHEME = /[a-z][a-z0-9+.-]*:\/\//;
const KEYWORD_NAME = /[\w-]+/;
const KEYWORD_PADDING = /[ \t\r\n\v\f]*/;
const NEXT_KEYWORD = `${KEYWORD_NAME.source}${KEYWORD_PADDING.source}=`;
const WRAPPED_FIELD_SEPARATOR = `[,;]${NEXT_KEYWORD}`;
const WRAPPED_URI = (
  [
    [String.raw`\(`, String.raw`\)`],
    [String.raw`\[`, String.raw`\]`],
    ["<", ">"],
    ["'", "'"],
    ['"', '"'],
  ] as const
)
  .map(
    ([start, end]) =>
      String.raw`(?<=${start})${URI_SCHEME.source}(?:(?!${end}${WRAPPED_FIELD_SEPARATOR})\S)*(?=${end}${WRAPPED_FIELD_SEPARATOR})`,
  )
  .join("|");
const URI_USERINFO = String.raw`(${URI_SCHEME.source})(?:[^/?#\s]+(?<!@)@|[^/\s]+(?<!@)@)`;
const WRAPPED_URI_OR_USERINFO = new RegExp(`${WRAPPED_URI}|${URI_USERINFO}`, "gi");
const URL_OR_KEYWORD = new RegExp(
  String.raw`${WRAPPED_URI}|${URI_SCHEME.source}\S+|(?<![\w?&-])(${KEYWORD_NAME.source})${KEYWORD_PADDING.source}=${KEYWORD_PADDING.source}`,
  "gi",
);
const QUOTED_KEYWORD_VALUE = /'(?:\\[\s\S]|[^'\\])*'|"(?:\\[\s\S]|[^"\\])*"/y;
const UNQUOTED_KEYWORD_CHARACTER = /\\[\s\S]|[^ \t\r\n\v\f\\]/;
const UNQUOTED_KEYWORD_VALUE = new RegExp(`(?:${UNQUOTED_KEYWORD_CHARACTER.source})+`, "y");
const DELIMITED_KEYWORD_VALUE = new RegExp(
  `(?:(?![,;&]${NEXT_KEYWORD})(?:${UNQUOTED_KEYWORD_CHARACTER.source}))+`,
  "y",
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
  const withoutUserInfo = value.replace(
    WRAPPED_URI_OR_USERINFO,
    (match: string, scheme: string | undefined) =>
      scheme === undefined
        ? match.replace(new RegExp(URI_USERINFO, "gi"), "$1[redacted]@")
        : `${scheme}[redacted]@`,
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
    const diagnostic = readDiagnosticFields && DIAGNOSTIC_FIELDS.test(key);
    const quote = detail.charAt(valueStart);
    if (diagnostic && quote !== "'" && quote !== '"') continue;
    const delimited =
      BASELINE_SENSITIVE_KEY.test(key) || /[,;&]/.test(detail.charAt(token.index - 1));
    const unquoted = delimited ? DELIMITED_KEYWORD_VALUE : UNQUOTED_KEYWORD_VALUE;
    const valueEnd = keywordValueEnd(
      detail,
      valueStart,
      unquoted,
      sensitive || diagnostic,
      diagnostic || ENVIRONMENT_KEY.test(key),
    );
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
      const redacted = redactKeywordValues(decoded, false);
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
  consumeUnclosed: boolean,
  allowDoubleQuote: boolean,
): number {
  const first = detail.charAt(start);
  if (first === "'" || (allowDoubleQuote && first === '"')) {
    QUOTED_KEYWORD_VALUE.lastIndex = start;
    if (QUOTED_KEYWORD_VALUE.test(detail)) {
      start = QUOTED_KEYWORD_VALUE.lastIndex;
      if (first === "'") return start;
    } else if (consumeUnclosed) {
      return detail.length;
    }
  }

  unquoted.lastIndex = start;
  return unquoted.test(detail) ? unquoted.lastIndex : start;
}
