import { redactDiagnosticCredentials } from "@croco/diagnostics-core";

export const SENSITIVE_DIAGNOSTIC_KEY =
  /(authorization|cookie|credential|password|secret|token|api[-_]?key|private[-_]?key|access[-_]?key|access[-_]?token|connection[-_]?string|clerk[-_]?secret[-_]?key|dsn)/i;

export function redactSensitiveValue(value: string, replacement = "[Redacted]"): string {
  return redactDiagnosticCredentials(value, SENSITIVE_DIAGNOSTIC_KEY, replacement);
}
