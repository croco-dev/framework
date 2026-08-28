import type {
  DesktopWireSchemaDiagnostic,
  DesktopWireSchemaDiagnosticCode,
  DesktopWireSourceLocation,
} from "./DesktopWireSchema";
import { compareCodeUnits, stringifyCanonicalJson } from "./canonicalJson";

export type DesktopContractGraphDiagnosticCode =
  | DesktopWireSchemaDiagnosticCode
  | "DESKTOP_GRAPH_AMBIGUOUS_GRANT_REFERENCE"
  | "DESKTOP_GRAPH_DUPLICATE_ID"
  | "DESKTOP_GRAPH_DUPLICATE_PROBLEM_CODE"
  | "DESKTOP_GRAPH_EFFECT_GRANT_ACCESS_MISMATCH"
  | "DESKTOP_GRAPH_INVALID_BYTE_LIMIT"
  | "DESKTOP_GRAPH_INVALID_CONCURRENCY"
  | "DESKTOP_GRAPH_INVALID_TIMEOUT"
  | "DESKTOP_GRAPH_MISSING_COMMAND_REFERENCE"
  | "DESKTOP_GRAPH_MISSING_EVENT_REFERENCE"
  | "DESKTOP_GRAPH_MISSING_GRANT_REFERENCE"
  | "DESKTOP_GRAPH_MISSING_WINDOW_REFERENCE"
  | "DESKTOP_GRAPH_PROBLEM_REGISTRY_INVALID"
  | "DESKTOP_GRAPH_PROBLEM_REGISTRY_MISMATCH"
  | "DESKTOP_GRAPH_PROBLEM_REGISTRY_MISSING"
  | "DESKTOP_GRAPH_QUERY_WRITE_EFFECT"
  | "DESKTOP_GRAPH_REMOTE_ORIGIN_INSECURE"
  | "DESKTOP_GRAPH_REMOTE_ORIGIN_MALFORMED"
  | "DESKTOP_GRAPH_REMOTE_ORIGIN_WILDCARD"
  | "DESKTOP_GRAPH_REMOTE_WINDOW_EXPOSURE"
  | "DESKTOP_GRAPH_RESERVED_ID"
  | "DESKTOP_GRAPH_UNSAFE_PROBLEM_EXTENSION";

export type DesktopContractGraphDiagnosticTargetKind =
  | "app"
  | "command"
  | "contract"
  | "effect"
  | "event"
  | "execution-policy"
  | "grant"
  | "problem"
  | "schema"
  | "window";

export type DesktopContractGraphDiagnostic = {
  readonly code: DesktopContractGraphDiagnosticCode;
  readonly severity: "error";
  readonly targetKind: DesktopContractGraphDiagnosticTargetKind;
  readonly memberId: string;
  /** @deprecated Use memberId. Retained for DesktopWire diagnostic compatibility. */
  readonly contractMember: string;
  readonly schemaPath: readonly string[];
  readonly message: string;
  readonly recovery: string;
  readonly sourceLocation?: DesktopWireSourceLocation;
};

export type CreateDesktopContractGraphDiagnosticOptions = {
  readonly code: DesktopContractGraphDiagnosticCode;
  readonly targetKind: DesktopContractGraphDiagnosticTargetKind;
  readonly memberId: string;
  readonly message: string;
  readonly recovery: string;
  readonly schemaPath?: readonly string[];
  readonly sourceLocation?: DesktopWireSourceLocation;
};

export function createDesktopContractGraphDiagnostic(
  options: CreateDesktopContractGraphDiagnosticOptions,
): DesktopContractGraphDiagnostic {
  return {
    code: options.code,
    severity: "error",
    targetKind: options.targetKind,
    memberId: options.memberId,
    contractMember: options.memberId,
    schemaPath: options.schemaPath ?? [],
    message: options.message,
    recovery: options.recovery,
    ...(options.sourceLocation ? { sourceLocation: options.sourceLocation } : {}),
  };
}

export function fromDesktopWireSchemaDiagnostic(
  diagnostic: DesktopWireSchemaDiagnostic,
): DesktopContractGraphDiagnostic {
  return createDesktopContractGraphDiagnostic({
    code: diagnostic.code,
    targetKind: "schema",
    memberId: diagnostic.contractMember,
    schemaPath: diagnostic.schemaPath,
    message: diagnostic.message,
    recovery: diagnostic.recovery,
    ...(diagnostic.sourceLocation ? { sourceLocation: diagnostic.sourceLocation } : {}),
  });
}

export function formatDesktopContractGraphDiagnostic(
  diagnostic: DesktopContractGraphDiagnostic,
): string {
  const schemaPath = diagnostic.schemaPath.length > 0 ? `.${diagnostic.schemaPath.join(".")}` : "";
  const location = diagnostic.sourceLocation
    ? ` (${diagnostic.sourceLocation.path}${formatPosition(diagnostic.sourceLocation)})`
    : "";

  return `${diagnostic.code} ${diagnostic.targetKind} ${diagnostic.memberId}${schemaPath}${location}: ${diagnostic.message} Recovery: ${diagnostic.recovery}`;
}

export function stringifyDesktopContractGraphDiagnostics(
  diagnostics: readonly DesktopContractGraphDiagnostic[],
): string {
  return `${stringifyCanonicalJson([...diagnostics].sort(compareDesktopContractGraphDiagnostics), 2)}\n`;
}

export function compareDesktopContractGraphDiagnostics(
  left: Pick<DesktopContractGraphDiagnostic, "code" | "memberId" | "schemaPath" | "targetKind">,
  right: Pick<DesktopContractGraphDiagnostic, "code" | "memberId" | "schemaPath" | "targetKind">,
): number {
  return (
    compareCodeUnits(left.memberId, right.memberId) ||
    compareCodeUnits(left.targetKind, right.targetKind) ||
    compareCodeUnits(left.schemaPath.join("."), right.schemaPath.join(".")) ||
    compareCodeUnits(left.code, right.code)
  );
}

function formatPosition(sourceLocation: DesktopWireSourceLocation): string {
  if (sourceLocation.line === undefined) return "";
  return sourceLocation.column === undefined
    ? `:${sourceLocation.line}`
    : `:${sourceLocation.line}:${sourceLocation.column}`;
}
