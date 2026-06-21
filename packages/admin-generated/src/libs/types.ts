import type { ContractAccessMetadata } from "@croco/protocols-core";

export type AdminGeneratedVersion = "croco.admin-generated.v1";

export type AdminGeneratedOperationKind =
  | "list"
  | "detail"
  | "create"
  | "update"
  | "delete"
  | "action";

export type AdminGeneratedOperationScope = "collection" | "record";

export type AdminGeneratedSchemaPresence = "present" | "absent";

export type AdminGeneratedProblem<
  Code extends string = string,
  Category extends string = string,
  Status extends number = number,
> = {
  readonly code: Code;
  readonly category: Category;
  readonly status: Status;
  readonly description?: string;
  readonly type?: string;
};

export type AdminGeneratedRequestMetadata = {
  readonly body: AdminGeneratedSchemaPresence;
  readonly path: AdminGeneratedSchemaPresence;
  readonly query: AdminGeneratedSchemaPresence;
  readonly headers: AdminGeneratedSchemaPresence;
};

export type AdminGeneratedClientBinding = {
  readonly routeId: string;
  readonly operationId: string;
  readonly methodName: string;
  readonly httpMethod: string;
  readonly path: string;
  readonly inputType?: string;
  readonly outputType?: string;
  readonly problemType: string;
  readonly problems: readonly AdminGeneratedProblem[];
};

export type AdminGeneratedResourceOperation = {
  readonly kind: Exclude<AdminGeneratedOperationKind, "action">;
  readonly routeId: string;
  readonly operationId: string;
  readonly methodName: string;
  readonly httpMethod: string;
  readonly path: string;
  readonly clientBinding: string;
  readonly inputType?: string;
  readonly outputType?: string;
  readonly problemType: string;
  readonly request: AdminGeneratedRequestMetadata;
  readonly response: AdminGeneratedSchemaPresence;
  readonly problems: readonly AdminGeneratedProblem[];
  readonly access: ContractAccessMetadata;
};

export type AdminGeneratedResourceAction = {
  readonly kind: "action";
  readonly scope: AdminGeneratedOperationScope;
  readonly action: string;
  readonly routeId: string;
  readonly operationId: string;
  readonly methodName: string;
  readonly httpMethod: string;
  readonly path: string;
  readonly clientBinding: string;
  readonly inputType?: string;
  readonly outputType?: string;
  readonly problemType: string;
  readonly request: AdminGeneratedRequestMetadata;
  readonly response: AdminGeneratedSchemaPresence;
  readonly problems: readonly AdminGeneratedProblem[];
  readonly access: ContractAccessMetadata;
};

export type AdminGeneratedResourceConfig = {
  readonly id: string;
  readonly label: string;
  readonly path: string;
  readonly routeIds: readonly string[];
  readonly operations: Partial<
    Record<Exclude<AdminGeneratedOperationKind, "action">, AdminGeneratedResourceOperation>
  >;
  readonly actions: readonly AdminGeneratedResourceAction[];
};

export type AdminGeneratedDiagnostic = {
  readonly code: string;
  readonly message: string;
  readonly routeId?: string;
  readonly path?: string;
};

export type AdminGeneratedArtifact = {
  readonly version: AdminGeneratedVersion;
  readonly resources: readonly AdminGeneratedResourceConfig[];
  readonly clientBindings: Readonly<Record<string, AdminGeneratedClientBinding>>;
  readonly diagnostics: readonly AdminGeneratedDiagnostic[];
};

export type AdminGenerateFilesOptions = {
  readonly resourceFileName?: string;
};
