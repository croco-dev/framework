const QUOTED_VALUE = /"(?:\\[\s\S]|[^"\\])*"|'(?:\\[\s\S]|[^'\\])*'/;
const AUTHORIZATION_VALUE = new RegExp(
  String.raw`((["']?)authorization\2\s*[:=]\s*)(?:(${QUOTED_VALUE.source})(?=[ \t]*(?:[,;}\]\r\n]|$))|(?:${QUOTED_VALUE.source}|[^;\r\n])+)`,
  "gi",
);
const SENSITIVE_VALUE = new RegExp(
  String.raw`((["']?)(?:cookie|credential|password|secret|token|api[-_]?key|private[-_]?key|access[-_]?key|access[-_]?token|connection[-_]?string|clerk[-_]?secret[-_]?key|dsn)\2\s*[:=]\s*)(?:(${QUOTED_VALUE.source})|\[redacted\]|[^,\s;}\]]+)`,
  "gi",
);

export function redactSensitiveValue(value: string, replacement = "[Redacted]"): string {
  const redact = (
    _match: string,
    prefix: string,
    _keyQuote: string,
    quotedValue?: string,
  ): string => {
    const quote = quotedValue?.charAt(0) ?? "";
    return `${prefix}${quote}${replacement}${quote}`;
  };

  return value.replace(AUTHORIZATION_VALUE, redact).replace(SENSITIVE_VALUE, redact);
}
