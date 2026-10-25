export const SENSITIVE_DIAGNOSTIC_KEY =
  /(authorization|cookie|credential|password|secret|token|api[-_]?key|private[-_]?key|access[-_]?key|access[-_]?token|connection[-_]?string|better[-_]?auth[-_]?url|dsn)/i;

const SENSITIVE_VALUE_PATTERN =
  /(authorization|cookie|credential|password|secret|token|api[-_]?key|private[-_]?key|access[-_]?key|access[-_]?token|connection[-_]?string|better[-_]?auth[-_]?url|dsn)(\s*[:=]\s*)([^,\s;]+)/gi;

export function redactSensitiveValue(
  value: string,
  replacement = "[redacted]",
  redactEntireValue = false,
): string {
  if (redactEntireValue) return replacement;
  return value
    .replace(/\b(authorization)(\s*[:=]\s*)[^,\n;]+/gi, `$1$2${replacement}`)
    .replace(
      SENSITIVE_VALUE_PATTERN,
      (_match: string, label: string, separator: string) => `${label}${separator}${replacement}`,
    );
}
