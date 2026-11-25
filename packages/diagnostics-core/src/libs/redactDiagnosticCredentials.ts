const FIELD =
  /(?<![\w.-])("(?:\\[\s\S]|[^"\\])*"|'(?:\\[\s\S]|[^'\\])*'|[\w.-]+)(?:[ \t]*([:=])[ \t]*|(?<=["'])\s*([:=])\s*)/g;
const AUTHORIZATION_LABEL = /authorization$/i;
const AUTHORIZATION_PARAMETERS = /[^\s,;]+[ \t]+[\w-]+[ \t]*=[ \t]*[^=\s,;]/y;

/**
 * Masks credential fields in diagnostic text. The caller supplies its sensitive-key policy
 * and handles any known secret values that appear without a field name.
 */
export function redactDiagnosticCredentials(
  message: string,
  sensitiveKey: RegExp,
  replacement = "[redacted]",
): string {
  const flags = sensitiveKey.flags.replace(/[gy]/g, "");
  const quotedKeyMatcher = new RegExp(sensitiveKey.source, flags);
  const plainKeyMatcher = new RegExp(`(?:${sensitiveKey.source})$`, flags);
  const fields = new RegExp(FIELD);
  const parts: string[] = [];
  let copiedThrough = 0;

  for (let field = fields.exec(message); field; field = fields.exec(message)) {
    const label = field[1] ?? "";
    const isQuotedKey = label.startsWith('"') || label.startsWith("'");
    const key = isQuotedKey ? decodeKey(label) : label;
    if (!(isQuotedKey ? quotedKeyMatcher : plainKeyMatcher).test(key)) continue;

    const separator = field[2] ?? field[3];
    const isJsonField = label.startsWith('"') && separator === ":";
    const authorization = AUTHORIZATION_LABEL.test(key);
    let start = fields.lastIndex;
    if (isJsonField) {
      while (start < message.length && /\s/.test(message.charAt(start))) start++;
    }

    const end = findValueEnd(message, start, { isQuotedKey, isJsonField, authorization });
    if (start === end) continue;

    const first = message.charAt(start);
    const quotedValue = (isQuotedKey || authorization) && first === message.charAt(end - 1);
    const quote = quotedValue && /["']/.test(first) ? first : "";
    const marker = isJsonField ? JSON.stringify(replacement) : quote + replacement + quote;
    parts.push(message.slice(copiedThrough, start), marker);
    copiedThrough = end;
    fields.lastIndex = end;
  }

  return parts.length === 0 ? message : parts.join("") + message.slice(copiedThrough);
}

function decodeKey(label: string): string {
  if (label.startsWith('"')) {
    try {
      return JSON.parse(label) as string;
    } catch {
      // Inspect-style output can quote keys without using JSON escapes.
    }
  }

  return label.slice(1, -1);
}

function findValueEnd(
  message: string,
  start: number,
  {
    isQuotedKey,
    isJsonField,
    authorization,
  }: {
    isQuotedKey: boolean;
    isJsonField: boolean;
    authorization: boolean;
  },
): number {
  const first = message.charAt(start);
  if ((isQuotedKey || authorization) && (first === '"' || first === "'")) {
    const end = findStringEnd(message, start, first);
    if (!authorization || isJsonField || /^[ \t]*(?:[,;}\]\r\n]|$)/.test(message.slice(end))) {
      return end;
    }
  }
  if (isJsonField && (first === "{" || first === "[")) {
    return findContainerEnd(message, start);
  }

  let end = start;
  if (authorization && !isJsonField) {
    AUTHORIZATION_PARAMETERS.lastIndex = start;
    const hasParameters = AUTHORIZATION_PARAMETERS.test(message);
    const delimiter = hasParameters ? /[;\r\n]/ : /[,;\r\n]/;
    while (end < message.length && !delimiter.test(message.charAt(end))) {
      const char = message.charAt(end);
      end = char === '"' || char === "'" ? findStringEnd(message, end, char) : end + 1;
    }
    return end;
  }

  const delimiter = isJsonField ? /[,\s}\]]/ : /[,\s;]/;
  while (end < message.length && !delimiter.test(message.charAt(end))) end++;
  return end;
}

function findStringEnd(message: string, start: number, quote: string): number {
  for (let index = start + 1; index < message.length; index++) {
    const char = message.charAt(index);
    if (char === quote) return index + 1;
    if (char === "\\") index++;
  }
  return message.length;
}

function findContainerEnd(message: string, start: number): number {
  let depth = 1;
  let index = start + 1;
  while (index < message.length) {
    const char = message.charAt(index);
    if (char === '"' || char === "'") {
      index = findStringEnd(message, index, char);
      continue;
    }
    if (char === "{" || char === "[") depth++;
    if (char === "}" || char === "]") depth--;
    index++;
    if (depth === 0) return index;
  }
  return message.length;
}
