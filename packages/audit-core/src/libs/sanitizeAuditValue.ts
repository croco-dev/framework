const REDACTED_VALUE = "[Redacted]";
const CIRCULAR_VALUE = "[Circular]";
const ACCESSOR_VALUE = "[Accessor]";
const UNSERIALIZABLE_VALUE = "[Unserializable]";

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

function sanitizeText(value: string): string {
  const sanitizedCookies = value.replace(
    /(["']?)(cookie|set[-_]?cookie)\1(\s*[:=]\s*)(?:"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|[^\r\n]+)/gi,
    replaceSecretLabel,
  );

  return sanitizedCookies.replace(
    /(["']?)(authorization|proxy[-_]?authorization|credential|password|passphrase|passwd|pwd|secret|token|api[-_]?key|private[-_]?key|access[-_]?key(?:[-_]?id)?|access[-_]?token|refresh[-_]?token|client[-_]?secret|connection[-_]?string|dsn)\1(\s*[:=]\s*)(?:"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|(?:bearer|basic|digest|apikey)\s+[^\s,;}\]]+|[^,\s;}\]]+)/gi,
    replaceSecretLabel,
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
