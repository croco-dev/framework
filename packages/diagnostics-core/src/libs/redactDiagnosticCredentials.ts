const FIELD =
  /(?<![\w.-])((?<!\\)(?:"(?:\\[\s\S]|[^"\\:=\r\n])*"|'(?:\\[\s\S]|[^'\\:=\r\n])*')|[\w.-]+)\s*([:=])\s*/g;
const AUTHORIZATION_LABEL = /authorization$/i;
const AUTHORIZATION_PARAMETERS = /[^\s,;]+[ \t]+[\w!#$%&'*+.^\x60|~-]+[ \t]*=[ \t]*[^=\s,;]/y;

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
  return redactText(message);

  function redactText(text: string): string {
    const fields = new RegExp(FIELD);
    const parts: string[] = [];
    let copiedThrough = 0;

    for (let field = fields.exec(text); field; field = fields.exec(text)) {
      const label = field[1] ?? "";
      const isQuotedKey = label.startsWith('"') || label.startsWith("'");
      const isJsonField = label.startsWith('"') && field[2] === ":";
      const key = isQuotedKey ? (parseJsonString(label) ?? label.slice(1, -1)) : label;
      const start = fields.lastIndex;
      const first = text.charAt(start);
      const sensitive = (isQuotedKey ? quotedKeyMatcher : plainKeyMatcher).test(key);

      let end: number;
      let marker: string;
      if (sensitive) {
        const authorization = AUTHORIZATION_LABEL.test(key);
        end = findValueEnd(text, start, { isQuotedKey, isJsonField, authorization });
        if (start === end) continue;

        const quotedValue = (isQuotedKey || authorization) && first === text.charAt(end - 1);
        const quote = quotedValue && /["']/.test(first) ? first : "";
        marker = isJsonField ? JSON.stringify(replacement) : quote + replacement + quote;
      } else if (isJsonField && first === '"') {
        end = findStringEnd(text, start, first);
        const decoded = parseJsonString(text.slice(start, end));
        if (decoded === undefined) continue;

        fields.lastIndex = end;
        const redacted = redactText(decoded);
        if (redacted === decoded) continue;
        marker = JSON.stringify(redacted);
      } else {
        continue;
      }

      parts.push(text.slice(copiedThrough, start), marker);
      copiedThrough = end;
      fields.lastIndex = end;
    }

    return parts.length === 0 ? text : parts.join("") + text.slice(copiedThrough);
  }
}

function parseJsonString(value: string): string | undefined {
  if (!value.startsWith('"')) return undefined;
  try {
    return JSON.parse(value) as string;
  } catch {
    return undefined;
  }
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
