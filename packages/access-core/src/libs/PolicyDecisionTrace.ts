import { recordEvent } from "@croco/telemetry-api";
import type { Problem } from "@croco/problems-core";

export const POLICY_DECISION_TRACE_VERSION = "croco.policy-decision-trace.v1";
export const POLICY_DECISION_TELEMETRY_EVENT = "policy.decision";
export const POLICY_DECISION_REDACTED_VALUE = "[Redacted]";
export const POLICY_DECISION_TRUNCATED_VALUE = "[Truncated]";

export type PolicyDecisionResult = "allow" | "deny" | "abstain";

export type PolicyDecisionSourceLocation = {
  readonly file: string;
  readonly line?: number;
  readonly column?: number;
};

export type PolicyDecisionTraceValue =
  | string
  | number
  | boolean
  | null
  | readonly PolicyDecisionTraceValue[]
  | { readonly [key: string]: PolicyDecisionTraceValue };

export type PolicyDecisionTraceInputs = Record<string, PolicyDecisionTraceValue>;

export type PolicyDecisionTraceRedaction = {
  readonly applied: boolean;
  readonly paths: readonly string[];
};

export type PolicyDecisionTrace = {
  readonly version: typeof POLICY_DECISION_TRACE_VERSION;
  readonly decisionId: string;
  readonly policyKind: string;
  readonly result: PolicyDecisionResult;
  readonly ruleId: string;
  readonly subjectRef?: string;
  readonly resourceRef?: string;
  readonly tenantId?: string;
  readonly sourceLocation?: PolicyDecisionSourceLocation;
  readonly reason?: string;
  readonly inputs: PolicyDecisionTraceInputs;
  readonly redaction: PolicyDecisionTraceRedaction;
};

export type PolicyDecisionTraceInput = {
  readonly decisionId?: string;
  readonly policyKind: string;
  readonly result: PolicyDecisionResult;
  readonly ruleId: string;
  readonly subjectRef?: string;
  readonly resourceRef?: string;
  readonly tenantId?: string;
  readonly sourceLocation?: PolicyDecisionSourceLocation;
  readonly reason?: string;
  readonly inputs?: Record<string, unknown>;
  readonly redaction?: PolicyDecisionRedactionOptions;
};

export type PolicyDecisionRedactionOptions = {
  readonly sensitiveKeyPattern?: RegExp;
  readonly maxDepth?: number;
  readonly maxStringLength?: number;
};

export type PolicyDecisionTraceSink = {
  recordPolicyDecisionTrace(trace: PolicyDecisionTrace): void | Promise<void>;
};

export type RecordPolicyDecisionTraceOptions = {
  readonly auditSink?: PolicyDecisionTraceSink;
};

type RedactionState = {
  readonly options: Required<PolicyDecisionRedactionOptions>;
  readonly paths: string[];
};

const DEFAULT_MAX_DEPTH = 5;
const DEFAULT_MAX_STRING_LENGTH = 500;
const DEFAULT_SENSITIVE_KEY_PATTERN =
  /authorization|cookie|credential|password|secret|token|api[-_]?key|private[-_]?key|access[-_]?key|database[-_]?url|redis[-_]?url|mongo(?:db)?[-_]?url|postgres(?:ql)?[-_]?url|connection[-_]?string|dsn/i;
const DEFAULT_SENSITIVE_VALUE_PATTERN =
  /((?:authorization|password|secret|token|api[-_]?key|access[-_]?key|private[-_]?key|credential|dsn)\s*[:=]\s*)[^\s,;&]+|((?:bearer|basic)\s+)[^\s,;]+|((?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?|redis):\/\/)[^\s]+/gi;

export function createPolicyDecisionTrace(input: PolicyDecisionTraceInput): PolicyDecisionTrace {
  const state: RedactionState = {
    options: {
      sensitiveKeyPattern: input.redaction?.sensitiveKeyPattern ?? DEFAULT_SENSITIVE_KEY_PATTERN,
      maxDepth: Math.max(1, Math.trunc(input.redaction?.maxDepth ?? DEFAULT_MAX_DEPTH)),
      maxStringLength: Math.max(
        1,
        Math.trunc(input.redaction?.maxStringLength ?? DEFAULT_MAX_STRING_LENGTH),
      ),
    },
    paths: [],
  };
  const inputs = sanitizePolicyDecisionInputs(input.inputs ?? {}, state);
  const reason = input.reason ? sanitizePolicyDecisionString(input.reason, state) : undefined;
  const redaction: PolicyDecisionTraceRedaction = {
    applied: state.paths.length > 0,
    paths: state.paths,
  };
  const traceWithoutId: Omit<PolicyDecisionTrace, "decisionId"> = {
    version: POLICY_DECISION_TRACE_VERSION,
    policyKind: input.policyKind,
    result: input.result,
    ruleId: input.ruleId,
    ...(input.subjectRef ? { subjectRef: input.subjectRef } : {}),
    ...(input.resourceRef ? { resourceRef: input.resourceRef } : {}),
    ...(input.tenantId ? { tenantId: input.tenantId } : {}),
    ...(input.sourceLocation ? { sourceLocation: input.sourceLocation } : {}),
    ...(reason ? { reason } : {}),
    inputs,
    redaction,
  };

  return {
    ...traceWithoutId,
    decisionId: input.decisionId ?? createPolicyDecisionId(traceWithoutId),
  };
}

export async function recordPolicyDecisionTrace(
  trace: PolicyDecisionTrace,
  options: RecordPolicyDecisionTraceOptions = {},
): Promise<void> {
  recordEvent(POLICY_DECISION_TELEMETRY_EVENT, toPolicyDecisionTelemetryAttributes(trace));
  await options.auditSink?.recordPolicyDecisionTrace(trace);
}

export function toPolicyDecisionTelemetryAttributes(
  trace: PolicyDecisionTrace,
): Record<string, string | number | boolean> {
  const attributes: Record<string, string | number | boolean> = {
    "policy.decision_id": trace.decisionId,
    "policy.kind": trace.policyKind,
    "policy.result": trace.result,
    "policy.rule_id": trace.ruleId,
  };

  if (trace.subjectRef) {
    attributes["policy.subject_ref"] = trace.subjectRef;
  }

  if (trace.resourceRef) {
    attributes["policy.resource_ref"] = trace.resourceRef;
  }

  if (trace.tenantId) {
    attributes["policy.tenant_id"] = trace.tenantId;
  }

  if (trace.reason) {
    attributes["policy.reason"] = trace.reason;
  }

  if (trace.sourceLocation) {
    attributes["policy.source.file"] = trace.sourceLocation.file;
    if (trace.sourceLocation.line !== undefined) {
      attributes["policy.source.line"] = trace.sourceLocation.line;
    }
    if (trace.sourceLocation.column !== undefined) {
      attributes["policy.source.column"] = trace.sourceLocation.column;
    }
  }

  attributes["policy.redaction.applied"] = trace.redaction.applied;

  return attributes;
}

export function addPolicyDecisionIdExtension<TProblem extends Problem>(
  problem: TProblem,
  decisionId: string,
): TProblem {
  Object.defineProperty(problem, "extensions", {
    configurable: true,
    enumerable: true,
    value: {
      ...problem.extensions,
      decisionId,
    },
    writable: true,
  });

  return problem;
}

export function capturePolicyDecisionSourceLocation(): PolicyDecisionSourceLocation | undefined {
  const stack = new Error().stack?.split("\n").slice(2) ?? [];

  for (const line of stack) {
    const sourceLocation = parseStackSourceLocation(line);
    if (!sourceLocation || isInternalPolicyDecisionFrame(sourceLocation.file)) {
      continue;
    }

    return sourceLocation;
  }

  return undefined;
}

function createPolicyDecisionId(input: Omit<PolicyDecisionTrace, "decisionId">): string {
  return `pdt_${hashString(stableStringify(input))}`;
}

function sanitizePolicyDecisionInputs(
  input: Record<string, unknown>,
  state: RedactionState,
): PolicyDecisionTraceInputs {
  const sanitized = sanitizePolicyDecisionValue(input, state, [], 0);
  return isPolicyDecisionTraceInputs(sanitized) ? sanitized : {};
}

function sanitizePolicyDecisionValue(
  value: unknown,
  state: RedactionState,
  path: readonly string[],
  depth: number,
): PolicyDecisionTraceValue {
  if (depth > state.options.maxDepth) {
    return POLICY_DECISION_TRUNCATED_VALUE;
  }

  if (value === undefined || value === null) {
    return null;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (value instanceof Error) {
    return {
      name: value.name,
      message: sanitizePolicyDecisionString(value.message, state, [...path, "message"]),
    };
  }

  if (typeof value === "bigint") {
    return value.toString();
  }

  if (typeof value === "string") {
    return sanitizePolicyDecisionString(value, state, path);
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : String(value);
  }

  if (typeof value === "boolean") {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((entry, index) =>
      sanitizePolicyDecisionValue(entry, state, [...path, String(index)], depth + 1),
    );
  }

  if (typeof value !== "object") {
    return String(value);
  }

  const output: Record<string, PolicyDecisionTraceValue> = {};
  for (const key of Object.keys(value)) {
    const nextPath = [...path, key];
    if (state.options.sensitiveKeyPattern.test(key)) {
      state.paths.push(formatPath(nextPath));
      output[key] = POLICY_DECISION_REDACTED_VALUE;
      continue;
    }

    try {
      output[key] = sanitizePolicyDecisionValue(
        (value as Record<string, unknown>)[key],
        state,
        nextPath,
        depth + 1,
      );
    } catch {
      output[key] = "[Unavailable]";
    }
  }

  return output;
}

function sanitizePolicyDecisionString(
  value: string,
  state: RedactionState,
  path: readonly string[] = [],
): string {
  let redacted = false;
  const scrubbed = value.replace(
    DEFAULT_SENSITIVE_VALUE_PATTERN,
    (_match, assignmentPrefix, authPrefix, urlPrefix) => {
      redacted = true;
      return `${assignmentPrefix ?? authPrefix ?? urlPrefix ?? ""}${POLICY_DECISION_REDACTED_VALUE}`;
    },
  );

  if (redacted) {
    state.paths.push(formatPath(path));
  }

  if (scrubbed.length <= state.options.maxStringLength) {
    return scrubbed;
  }

  return `${scrubbed.slice(0, state.options.maxStringLength)}...${POLICY_DECISION_TRUNCATED_VALUE}`;
}

function isPolicyDecisionTraceInputs(
  value: PolicyDecisionTraceValue,
): value is PolicyDecisionTraceInputs {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function formatPath(path: readonly string[]): string {
  return path.length === 0 ? "$" : path.join(".");
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableStringify(entry)).join(",")}]`;
  }

  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
    .join(",")}}`;
}

function hashString(value: string): string {
  let h1 = 0xdeadbeef ^ value.length;
  let h2 = 0x41c6ce57 ^ value.length;

  for (let index = 0; index < value.length; index += 1) {
    const charCode = value.charCodeAt(index);
    h1 = Math.imul(h1 ^ charCode, 2654435761);
    h2 = Math.imul(h2 ^ charCode, 1597334677);
  }

  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);

  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

function parseStackSourceLocation(line: string): PolicyDecisionSourceLocation | undefined {
  const trimmed = line.trim();
  const match =
    trimmed.match(/\(?((?:file:\/\/)?\/.*):(\d+):(\d+)\)?$/) ??
    trimmed.match(/\(?([A-Za-z]:\\.*):(\d+):(\d+)\)?$/);
  if (!match) {
    return undefined;
  }

  return {
    file: match[1].replace(/^file:\/\//, ""),
    line: Number(match[2]),
    column: Number(match[3]),
  };
}

function isInternalPolicyDecisionFrame(file: string): boolean {
  return (
    file.includes("/node_modules/") ||
    file.endsWith("/PolicyDecisionTrace.ts") ||
    file.endsWith("/Access.ts") ||
    file.endsWith("/RequireEntitlement.ts")
  );
}
