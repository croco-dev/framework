export const SENSITIVE_DIAGNOSTIC_KEY =
  /(authorization|cookie|credential|password|secret|token|api[-_]?key|private[-_]?key|access[-_]?key|access[-_]?token|connection[-_]?string|better[-_]?auth[-_]?url|dsn)/i;

const SENSITIVE_VALUE_PATTERN =
  /(authorization|cookie|credential|password|secret|token|api[-_]?key|private[-_]?key|access[-_]?key|access[-_]?token|connection[-_]?string|better[-_]?auth[-_]?url|dsn)(\s*[:=]\s*)([^,\s;]+)/gi;

export function redactSensitiveValue(value: string, replacement = "[redacted]"): string {
  return value
    .replace(
      /\b(authorization|cookie)(\s*[:=]\s*)[^\r\n]+/gi,
      (_match: string, label: string, separator: string) => `${label}${separator}${replacement}`,
    )
    .replace(
      SENSITIVE_VALUE_PATTERN,
      (_match: string, label: string, separator: string) => `${label}${separator}${replacement}`,
    );
}
