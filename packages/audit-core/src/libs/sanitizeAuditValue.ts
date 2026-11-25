const REDACTED_VALUE = "[Redacted]";
const CIRCULAR_VALUE = "[Circular]";
const ACCESSOR_VALUE = "[Accessor]";
const UNSERIALIZABLE_VALUE = "[Unserializable]";

const QUOTED_SECRET_VALUE = /"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/;
const BACKTICK_QUOTED_TEXT = /`(?:\\.|[^`\\])*`/;
const DIAGNOSTIC_LITERAL = `(?:${QUOTED_SECRET_VALUE.source}|${BACKTICK_QUOTED_TEXT.source})`;
const QUOTED_DIAGNOSTIC_TEXT = String.raw`${DIAGNOSTIC_LITERAL}(?:[ \t]*\+[ \t]*(?:\r\n|[\r\n])[ \t]*${DIAGNOSTIC_LITERAL})*`;
const DIAGNOSTIC_LITERALS = new RegExp(DIAGNOSTIC_LITERAL, "g");
const HTTP_TOKEN_CHARACTER = String.raw`[!#$%&'*+.^_\x60|~\da-z-]`;
const HEADER_CONTINUATION = String.raw`(?:\r\n|[\r\n])\1[ \t]+`;
const AUTHORIZATION_NAME = String.raw`(?:proxy[-_]?)?authorization`;
const AUTHORIZATION_LABEL = String.raw`(?:^([ \t]*)|(?<!${HTTP_TOKEN_CHARACTER}))(["']?)${AUTHORIZATION_NAME}\2`;
const VALUE_GAP = String.raw`[ \t]*(?:${HEADER_CONTINUATION})*`;
const ASSIGNMENT_SEPARATOR = String.raw`(?:(?<=["'])\s*[:=]\s*|[ \t]*=${VALUE_GAP})`;
const OBJECT_PROPERTY_SEPARATOR = String.raw`(?<=["']|[{,]\s*${AUTHORIZATION_NAME})\s*:\s*`;
const OBJECT_PROPERTY_END = String.raw`(?=\s*(?:}|,\s*(?:${DIAGNOSTIC_LITERAL}|[\w$]+)\s*:))`;
// RFC 9110 permits apostrophes in scheme tokens and defines token68 and named credential parameters.
const CREDENTIAL_GAP = String.raw`(?:[ \t]*(?:${HEADER_CONTINUATION})+|[ \t]+)`;
const HTTP_CREDENTIAL = String.raw`(?:(?:,${VALUE_GAP})*${HTTP_TOKEN_CHARACTER}+${VALUE_GAP}=|[a-z0-9._~+/-]+=*(?=[ \t]*(?:[\r\n]|$)))`;
const APOSTROPHE_SCHEME =
  String.raw`'(?:` +
  String.raw`(?=${HTTP_TOKEN_CHARACTER}*?')${HTTP_TOKEN_CHARACTER}*${CREDENTIAL_GAP}\S|` +
  String.raw`${HTTP_TOKEN_CHARACTER}*${CREDENTIAL_GAP}${HTTP_CREDENTIAL})`;
const AUTHORIZATION_VALUE =
  String.raw`(?:${OBJECT_PROPERTY_SEPARATOR}(?:(null)|(${QUOTED_DIAGNOSTIC_TEXT}))${OBJECT_PROPERTY_END}|` +
  String.raw`${ASSIGNMENT_SEPARATOR}(${QUOTED_DIAGNOSTIC_TEXT})(?!${HTTP_TOKEN_CHARACTER})|` +
  String.raw`[ \t]*:${VALUE_GAP}(?!${APOSTROPHE_SCHEME})(${QUOTED_SECRET_VALUE.source})|` +
  String.raw`[ \t]*[:=]${VALUE_GAP}(\S[^\r\n]*(?:${HEADER_CONTINUATION}[^\r\n]*)*))`;
const AUTHORIZATION_OR_QUOTED_TEXT = new RegExp(
  String.raw`${AUTHORIZATION_LABEL}${AUTHORIZATION_VALUE}|(?<![\w\\])(?:${QUOTED_DIAGNOSTIC_TEXT})`,
  "gim",
);
const LEGACY_AUTHORIZATION_LABEL = String.raw`(?<=${HTTP_TOKEN_CHARACTER})(?<!proxy[-_]?)(${AUTHORIZATION_NAME})(\s*[:=]\s*)`;
const LABELLED_SECRET = new RegExp(
  String.raw`(?:${LEGACY_AUTHORIZATION_LABEL}|(["']?)(credential|password|passphrase|passwd|pwd|secret|token|api[-_]?key|private[-_]?key|access[-_]?key(?:[-_]?id)?|access[-_]?token|refresh[-_]?token|client[-_]?secret|connection[-_]?string|dsn)\3(\s*[:=]\s*))(?:\[Redacted\]|${QUOTED_SECRET_VALUE.source}|(?:bearer|basic|digest|apikey)\s+[^\s,;}\]]+|[^,\s;}\]]+)`,
  "gi",
);

const SENSITIVE_KEYS = new Set([
  "accesstoken",
  "accesskey",
  "accesskeyid",
  "apikey",
  "authorization",
  "clientsecret",
  "connectionstring",
  "cookie",
  "credential",
  "credentials",
  "dsn",
  "idtoken",
  "password",
  "passphrase",
  "passwd",
  "privatekey",
  "proxyauthorization",
  "pwd",
  "refreshtoken",
  "secret",
  "secretaccesskey",
  "setcookie",
  "token",
  "webhooksignature",
  "xapikey",
  "xwebhooksignature",
]);

const SENSITIVE_KEY_SUFFIXES = [
  "accesstoken",
  "accesskey",
  "apikey",
  "authorization",
  "clientsecret",
  "connectionstring",
  "cookie",
  "credential",
  "credentials",
  "dsn",
  "password",
  "passphrase",
  "privatekey",
  "refreshtoken",
  "secret",
  "secrets",
  "token",
  "tokens",
];

function normalizeKey(key: string): string {
  return key.replace(/[^a-z0-9]/gi, "").toLowerCase();
}

function isSensitiveKey(key: string): boolean {
  const normalizedKey = normalizeKey(key);
  return (
    SENSITIVE_KEYS.has(normalizedKey) ||
    SENSITIVE_KEY_SUFFIXES.some((suffix) => normalizedKey.endsWith(suffix))
  );
}

function replaceSecretLabel(
  match: string,
  labelQuote: string,
  label: string,
  separator: string,
): string {
  const value = match.slice(labelQuote.length * 2 + label.length + separator.length);
  const valueQuote = value.startsWith('"') || value.startsWith("'") ? value[0] : "";
  return `${labelQuote}${label}${labelQuote}${separator}${valueQuote}${REDACTED_VALUE}${valueQuote}`;
}

function decodeQuotedText(value: string): string | undefined {
  if (!value.includes("\\")) {
    return undefined;
  }
  const content = value.slice(1, -1).replace(/\\(?:x[\da-f]{2}|[\s\S])|"/gi, (token) => {
    if (token === "\\'" || token === "\\`") return token[1];
    if (token.startsWith("\\x")) return `\\u00${token.slice(2)}`;
    return token === '"' ? '\\"' : token;
  });
  try {
    const decoded: unknown = JSON.parse(`"${content}"`);
    return typeof decoded === "string" ? decoded : undefined;
  } catch {
    return undefined;
  }
}

function encodeQuotedText(value: string, quote: string): string {
  const json = JSON.stringify(value);
  if (quote === '"') return json;

  const content = json.slice(1, -1).replace(/\\[\s\S]|['`]/g, (token) => {
    if (token === '\\"') return '"';
    return token === quote ? `\\${quote}` : token;
  });
  return `${quote}${content}${quote}`;
}

function sanitizeQuotedDiagnostic(value: string): string {
  const parts = value.match(DIAGNOSTIC_LITERALS) ?? [];
  const decodedParts = parts.map(decodeQuotedText);
  const text = parts.map((part, index) => decodedParts[index] ?? part.slice(1, -1)).join("");
  const sanitized = sanitizeAuthorizationText(text);
  if (sanitized === text) return value;

  const quote = value[0] ?? '"';
  if (parts.length === 1 && decodedParts[0] === undefined) {
    return `${quote}${sanitized}${quote}`;
  }
  return encodeQuotedText(sanitized, quote);
}

function sanitizeAuthorizationText(value: string): string {
  return value.replace(
    AUTHORIZATION_OR_QUOTED_TEXT,
    (
      match,
      _indent,
      _keyQuote,
      absentValue?,
      objectQuotedValue?,
      assignedValue?,
      headerQuotedValue?,
      unquotedValue?,
    ) => {
      if (absentValue !== undefined) return match;

      const quotedValue: string | undefined =
        objectQuotedValue ?? assignedValue ?? headerQuotedValue;
      const authorizationValue: string | undefined = quotedValue ?? unquotedValue;
      if (authorizationValue !== undefined) {
        const prefix = match.slice(0, -authorizationValue.length);
        const quote = quotedValue?.[0] ?? "";
        return `${prefix}${quote}${REDACTED_VALUE}${quote}`;
      }

      return sanitizeQuotedDiagnostic(match);
    },
  );
}

function sanitizeText(value: string): string {
  const sanitizedAuthorization = sanitizeAuthorizationText(value);
  const sanitizedCookies = sanitizedAuthorization.replace(
    /(["']?)(cookie|set[-_]?cookie)\1(\s*[:=]\s*)(?:"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|[^\r\n]+)/gi,
    replaceSecretLabel,
  );

  return sanitizedCookies.replace(
    LABELLED_SECRET,
    (match, legacyLabel, legacySeparator, quote, label, separator) =>
      replaceSecretLabel(match, quote ?? "", legacyLabel ?? label, legacySeparator ?? separator),
  );
}

function sanitizeArray(value: unknown[], ancestors: WeakSet<object>): unknown[] | string {
  let lengthDescriptor: PropertyDescriptor | undefined;
  try {
    lengthDescriptor = Object.getOwnPropertyDescriptor(value, "length");
  } catch {
    return UNSERIALIZABLE_VALUE;
  }

  const length = lengthDescriptor?.value;
  if (typeof length !== "number") {
    return UNSERIALIZABLE_VALUE;
  }

  const sanitized = Array.from<unknown>({ length });
  for (let index = 0; index < length; index += 1) {
    let descriptor: PropertyDescriptor | undefined;
    try {
      descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    } catch {
      sanitized[index] = UNSERIALIZABLE_VALUE;
      continue;
    }

    if (!descriptor) {
      continue;
    }
    sanitized[index] =
      "value" in descriptor ? sanitizeValue(descriptor.value, ancestors) : ACCESSOR_VALUE;
  }
  return sanitized;
}

function sanitizeObject(
  value: object,
  ancestors: WeakSet<object>,
): Record<string, unknown> | string {
  let descriptors: Record<string, PropertyDescriptor>;
  try {
    descriptors = Object.getOwnPropertyDescriptors(value);
  } catch {
    return UNSERIALIZABLE_VALUE;
  }

  const sanitizedEntries: [string, unknown][] = [];
  for (const [key, descriptor] of Object.entries(descriptors)) {
    if (!descriptor.enumerable || key === "toJSON") {
      continue;
    }
    sanitizedEntries.push([
      key,
      isSensitiveKey(key)
        ? REDACTED_VALUE
        : "value" in descriptor
          ? sanitizeValue(descriptor.value, ancestors)
          : ACCESSOR_VALUE,
    ]);
  }
  return Object.fromEntries(sanitizedEntries);
}

function sanitizeValue(value: unknown, ancestors: WeakSet<object>): unknown {
  if (typeof value === "bigint") {
    return String(value);
  }

  if (typeof value === "string") {
    return sanitizeText(value);
  }

  if (value instanceof Date) {
    return new Date(Date.prototype.getTime.call(value));
  }

  if (value === null || typeof value !== "object") {
    return value;
  }

  if (ancestors.has(value)) {
    return CIRCULAR_VALUE;
  }

  ancestors.add(value);
  try {
    if (Array.isArray(value)) {
      return sanitizeArray(value, ancestors);
    }
    return sanitizeObject(value, ancestors);
  } finally {
    ancestors.delete(value);
  }
}

export function sanitizeAuditValue(value: unknown): unknown {
  try {
    return sanitizeValue(value, new WeakSet());
  } catch {
    return UNSERIALIZABLE_VALUE;
  }
}
