const JSON_STRING = /"(?:\\(?:["\\/bfnrt]|u[\da-fA-F]{4})|[^"\\\r\n])*"/;
const JSON_VALUE_START =
  /["[{]|(?:null|true|false|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[Ee][+-]?\d+)?)(?=\s*(?:[,}\]]|$))/y;
const JSON_KEY = String.raw`(?=")(?<=[{,]\s*)(${JSON_STRING.source})(?=\s*:\s*(?:${JSON_VALUE_START.source}))`;
const TEXT_LABEL =
  /(?<![\w.-])((?<!\\)(?:"(?:\\[\s\S]|[^"\\:=\r\n])*"|'(?:\\[\s\S]|[^'\\:=\r\n])*')|[\w.-]+)/;
const QUOTED_TEXT = String.raw`(?=")(?<![\w\\])(${JSON_STRING.source})(?!\s*[:=])`;
const FIELD_OR_STRING = new RegExp(
  String.raw`(?:${JSON_KEY}|${TEXT_LABEL.source})\s*([:=])(\s*)|${QUOTED_TEXT}`,
  "g",
);
const AUTHORIZATION_LABEL = /authorization$/i;
const AUTHORIZATION_PARAMETERS = /[^\s,;]+[ \t]+[\w!#$%&'*+.^\x60|~-]+[ \t]*=[ \t]*[^=\s,;]/y;
const NEXT_DIAGNOSTIC_FIELD = /[\w.-]+[ \t]*[:=][ \t]*(?=[^=\s])/y;

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
    const fields = new RegExp(FIELD_OR_STRING);
    const parts: string[] = [];
    let copiedThrough = 0;

    for (let field = fields.exec(text); field; field = fields.exec(text)) {
      const [, jsonKey, textLabel, separator, fieldPadding, quotedText] = field;
      const label = jsonKey ?? textLabel ?? "";
      const isQuotedKey = label.startsWith('"') || label.startsWith("'");
      const key = isQuotedKey ? (parseJsonString(label) ?? label.slice(1, -1)) : label;
      const start = quotedText === undefined ? fields.lastIndex : field.index;
      JSON_VALUE_START.lastIndex = start;
      const isJsonField = label.startsWith('"') && separator === ":" && JSON_VALUE_START.test(text);
      const first = text.charAt(start);
      const sensitive =
        quotedText === undefined && (isQuotedKey ? quotedKeyMatcher : plainKeyMatcher).test(key);

      if (isJsonField && /[:=]/.test(key)) {
        const redactedKey = redactText(key);
        if (redactedKey !== key) {
          parts.push(text.slice(copiedThrough, field.index), JSON.stringify(redactedKey));
          copiedThrough = field.index + label.length;
        }
      }

      let end: number;
      let marker: string;
      if (sensitive) {
        const authorization = AUTHORIZATION_LABEL.test(key);
        if (authorization && !isJsonField && /[\r\n]$/.test(fieldPadding ?? "")) {
          NEXT_DIAGNOSTIC_FIELD.lastIndex = start;
          if (NEXT_DIAGNOSTIC_FIELD.test(text)) continue;
        }
        end = findValueEnd(text, start, { isQuotedKey, isJsonField, authorization });
        if (start === end) continue;

        const quotedValue = (isQuotedKey || authorization) && first === text.charAt(end - 1);
        const quote = quotedValue && /["']/.test(first) ? first : "";
        marker = isJsonField ? JSON.stringify(replacement) : quote + replacement + quote;
      } else if (quotedText !== undefined || (isJsonField && first === '"')) {
        end = quotedText === undefined ? findStringEnd(text, start, first) : fields.lastIndex;
        const decoded = parseJsonString(quotedText ?? text.slice(start, end));
        if (decoded === undefined) {
          fields.lastIndex = start + 1;
          continue;
        }

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
    const quotedAuthValue =
      !/[\r\n]/.test(message.slice(start, end)) &&
      /^[ \t]*(?:[,;}\]\r\n]|$)/.test(message.slice(end));
    if (isQuotedKey || quotedAuthValue) {
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
    const delimiter = hasParameters ? /[\r\n]/ : /[,;\r\n]/;
    while (end < message.length && !delimiter.test(message.charAt(end))) end++;
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
