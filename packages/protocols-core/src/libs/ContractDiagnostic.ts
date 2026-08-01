export type ContractDiagnosticSeverity = "error" | "warning";

export type ContractDiagnosticTarget =
  | "graph"
  | "controller"
  | "route"
  | "param"
  | "schema"
  | "problem"
  | "meter"
  | "plan-version"
  | "entitlement"
  | "provider";

export type ContractDiagnosticSource = "credential-free-structural" | "remote-provider-preflight";

export type ContractDiagnosticEvidence = {
  readonly kind: string;
  readonly references: readonly string[];
};

export type ContractDiagnosticRecovery = {
  readonly action: string;
  readonly link?: string;
};

export type ContractDiagnosticSourceLocation = {
  readonly path: string;
  readonly line?: number;
  readonly column?: number;
};

export type ContractDiagnostic = {
  readonly code: string;
  readonly severity: ContractDiagnosticSeverity;
  readonly target: ContractDiagnosticTarget;
  readonly message: string;
  readonly routeId?: string;
  readonly contractId?: string;
  readonly controllerName?: string;
  readonly methodName?: string;
  readonly path?: string;
  readonly sourceLocation?: ContractDiagnosticSourceLocation;
  readonly source?: ContractDiagnosticSource;
  readonly evidence?: ContractDiagnosticEvidence;
  readonly recovery?: ContractDiagnosticRecovery;
};
