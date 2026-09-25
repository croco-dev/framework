import { Problem, ProblemCategory } from "@croco/problems-core";

import type { AdminProblemContract } from "./types";

export const EVENT_CATALOG_READ_PERMISSION = "analytics:read";
export const EVENT_CATALOG_VALIDATE_PERMISSION = "analytics:validate";
export const EVENT_CATALOG_APP_READ_PERMISSION = "analytics:app:read";
export const EVENT_CATALOG_APP_VALIDATE_PERMISSION = "analytics:app:validate";

export type EventCatalogScope =
  | { readonly kind: "app"; readonly appId: string; readonly environment: string }
  | {
      readonly kind: "tenant";
      readonly tenantId: string;
      readonly appId: string;
      readonly environment: string;
    };

export type EventCatalogDescriptor = {
  readonly name: string;
  readonly description: string;
  readonly version: number;
  readonly subjectKind: "user" | "tenant" | "anonymous";
  readonly occurrence: "intent" | "committed" | "client-observed";
  readonly scope: "app" | "tenant";
  readonly schema: Readonly<Record<string, unknown>>;
  readonly propertyDescriptions: Readonly<Record<string, string>>;
  readonly sourceLocation: string;
  readonly owner: string;
};

export type EventCatalogObservation =
  | { readonly kind: "unobserved" }
  | {
      readonly kind: "observed";
      readonly receivedCount: number;
      readonly lastReceivedAt?: string;
      readonly recentFailureCodes: readonly string[];
    };

export type EventCatalogRegistry = {
  listDescriptors(): readonly EventCatalogDescriptor[];
  getDescriptor(name: string, version: number): EventCatalogDescriptor | undefined;
  validatePayload(
    name: string,
    version: number,
    payload: unknown,
  ): { readonly status: "valid" } | { readonly status: "invalid"; readonly code: string };
  getObservation(scope: EventCatalogScope, name: string, version: number): EventCatalogObservation;
};

export type EventCatalogSourceRequest = {
  readonly scope: EventCatalogScope;
  readonly principalId: string;
  readonly grantedPermissions: readonly string[];
  readonly signal?: AbortSignal;
};

export type EventCatalogSourceValidationRequest = EventCatalogSourceRequest & {
  readonly name: string;
  readonly version: number;
  readonly payload: unknown;
};

export type EventCatalogSourceLoadResult =
  | {
      readonly kind: "ready";
      readonly scope: EventCatalogScope;
      readonly entries: readonly EventCatalogEntry[];
    }
  | {
      readonly kind: "partial";
      readonly scope: EventCatalogScope;
      readonly entries: readonly EventCatalogEntry[];
      readonly problem: AdminProblemContract;
    }
  | { readonly kind: "unsupported"; readonly scope: EventCatalogScope }
  | {
      readonly kind: "problem";
      readonly scope: EventCatalogScope;
      readonly problem: AdminProblemContract;
    };

export type EventCatalogSourceValidationResult =
  | { readonly kind: "valid"; readonly scope: EventCatalogScope }
  | { readonly kind: "invalid"; readonly scope: EventCatalogScope; readonly code: string }
  | { readonly kind: "not-found"; readonly scope: EventCatalogScope }
  | { readonly kind: "unsupported"; readonly scope: EventCatalogScope }
  | {
      readonly kind: "problem";
      readonly scope: EventCatalogScope;
      readonly problem: AdminProblemContract;
    };

export type EventCatalogSource = {
  load(input: EventCatalogSourceRequest): Promise<EventCatalogSourceLoadResult>;
  validate(input: EventCatalogSourceValidationRequest): Promise<EventCatalogSourceValidationResult>;
};

export type EventCatalogInput = EventCatalogScope & {
  /** Permissions must be resolved and validated by the server for this principal and scope. */
  readonly principalId: string;
  readonly grantedPermissions: readonly string[];
  readonly source: EventCatalogSource;
  readonly signal?: AbortSignal;
};

export type EventCatalogEntry = {
  readonly descriptor: EventCatalogDescriptor;
  readonly observation: EventCatalogObservation;
};

export type EventCatalogState =
  | { readonly kind: "loading"; readonly scope: EventCatalogScope }
  | { readonly kind: "empty"; readonly scope: EventCatalogScope }
  | {
      readonly kind: "ready";
      readonly scope: EventCatalogScope;
      readonly entries: readonly EventCatalogEntry[];
    }
  | {
      readonly kind: "partial";
      readonly scope: EventCatalogScope;
      readonly entries: readonly EventCatalogEntry[];
      readonly problem: AdminProblemContract;
    }
  | {
      readonly kind: "permission-denied";
      readonly scope: EventCatalogScope;
      readonly requiredPermissions: readonly string[];
      readonly problem: AdminProblemContract;
    }
  | {
      readonly kind: "unsupported";
      readonly scope: EventCatalogScope;
      readonly problem: AdminProblemContract;
    }
  | {
      readonly kind: "problem";
      readonly scope: EventCatalogScope;
      readonly problem: AdminProblemContract;
    };

export type EventCatalogPayloadValidationInput = EventCatalogInput & {
  readonly name: string;
  readonly version: number;
  readonly payload: unknown;
};

export type EventCatalogPayloadValidationState =
  | { readonly kind: "valid"; readonly scope: EventCatalogScope; readonly delivery: "not-sent" }
  | {
      readonly kind: "invalid";
      readonly scope: EventCatalogScope;
      readonly delivery: "not-sent";
      readonly problem: AdminProblemContract;
    }
  | {
      readonly kind: "not-found";
      readonly scope: EventCatalogScope;
      readonly delivery: "not-sent";
      readonly problem: AdminProblemContract;
    }
  | {
      readonly kind: "permission-denied";
      readonly scope: EventCatalogScope;
      readonly requiredPermissions: readonly string[];
      readonly problem: AdminProblemContract;
    }
  | {
      readonly kind: "unsupported";
      readonly scope: EventCatalogScope;
      readonly problem: AdminProblemContract;
    }
  | {
      readonly kind: "problem";
      readonly scope: EventCatalogScope;
      readonly problem: AdminProblemContract;
    };

export class EventCatalogValidationProblem extends Problem {
  constructor(field: string, reason = "required") {
    super(
      "admin-core/event-catalog-validation-failed",
      ProblemCategory.ValidationError,
      `${field} is ${reason}`,
      {
        extensions: { field },
      },
    );
  }
}

export function createEventCatalogLoadingState(scope: EventCatalogScope): EventCatalogState {
  assertScope(scope);
  return { kind: "loading", scope };
}

/** Use this source in a trusted server process; remote clients should implement the same async source contract. */
export function createInProcessEventCatalogSource(
  catalog: EventCatalogRegistry,
): EventCatalogSource {
  return {
    async load({ scope }) {
      return {
        kind: "ready",
        scope,
        entries: catalog
          .listDescriptors()
          .filter((descriptor) => descriptor.scope === scope.kind)
          .map((descriptor) => ({
            descriptor,
            observation: catalog.getObservation(scope, descriptor.name, descriptor.version),
          })),
      };
    },
    async validate({ scope, name, version, payload }) {
      if (catalog.getDescriptor(name, version)?.scope !== scope.kind) {
        return { kind: "not-found", scope };
      }
      const result = catalog.validatePayload(name, version, payload);
      return result.status === "valid"
        ? { kind: "valid", scope }
        : { kind: "invalid", scope, code: result.code };
    },
  };
}

export async function loadEventCatalog(input: EventCatalogInput): Promise<EventCatalogState> {
  const scope = scopeFrom(input);
  assertAccessInput(input);
  const permission =
    scope.kind === "app" ? EVENT_CATALOG_APP_READ_PERMISSION : EVENT_CATALOG_READ_PERMISSION;
  if (!input.grantedPermissions.includes(permission)) {
    return permissionDenied(scope, permission);
  }

  const result = await loadScopedCatalog(input, scope);
  if (result.kind !== "ready" && result.kind !== "partial") {
    return result;
  }

  for (const entry of result.entries) {
    if (entry.descriptor.scope !== scope.kind) {
      return {
        kind: "problem",
        scope,
        problem: {
          code: "admin-core/event-catalog-descriptor-scope-invalid",
          status: 502,
          title: "Event catalog descriptor scope is invalid",
        },
      };
    }
    if (!isValidObservation(entry.observation)) {
      return {
        kind: "problem",
        scope,
        problem: {
          code: "admin-core/event-catalog-observation-invalid",
          status: 502,
          title: "Event catalog observation is invalid",
        },
      };
    }
  }
  if (result.kind === "partial") {
    return { kind: "partial", scope, entries: result.entries, problem: result.problem };
  }
  if (result.entries.length === 0) {
    return { kind: "empty", scope };
  }
  return { kind: "ready", scope, entries: result.entries };
}

function isValidObservation(observation: unknown): observation is EventCatalogObservation {
  if (typeof observation !== "object" || observation === null || !("kind" in observation)) {
    return false;
  }
  if (observation.kind === "unobserved") {
    return true;
  }
  return (
    observation.kind === "observed" &&
    "receivedCount" in observation &&
    typeof observation.receivedCount === "number" &&
    Number.isSafeInteger(observation.receivedCount) &&
    observation.receivedCount >= 0 &&
    (!("lastReceivedAt" in observation) ||
      observation.lastReceivedAt === undefined ||
      typeof observation.lastReceivedAt === "string") &&
    (observation.receivedCount > 0 ||
      !("lastReceivedAt" in observation) ||
      observation.lastReceivedAt === undefined) &&
    "recentFailureCodes" in observation &&
    Array.isArray(observation.recentFailureCodes) &&
    observation.recentFailureCodes.every((code: unknown) => typeof code === "string")
  );
}

export async function validateEventCatalogPayload(
  input: EventCatalogPayloadValidationInput,
): Promise<EventCatalogPayloadValidationState> {
  const scope = scopeFrom(input);
  assertAccessInput(input);
  if (!input.name.trim()) {
    throw new EventCatalogValidationProblem("name");
  }
  if (!Number.isSafeInteger(input.version) || input.version <= 0) {
    throw new EventCatalogValidationProblem("version", "not a positive safe integer");
  }
  const permission =
    scope.kind === "app"
      ? EVENT_CATALOG_APP_VALIDATE_PERMISSION
      : EVENT_CATALOG_VALIDATE_PERMISSION;
  if (!input.grantedPermissions.includes(permission)) {
    return permissionDenied(scope, permission);
  }

  let result: EventCatalogSourceValidationResult;
  try {
    result = await input.source.validate({
      scope,
      principalId: input.principalId,
      grantedPermissions: input.grantedPermissions,
      name: input.name,
      version: input.version,
      payload: input.payload,
      signal: input.signal,
    });
  } catch (caught) {
    if (input.signal?.aborted) {
      throw input.signal.reason ?? caught;
    }
    return {
      kind: "problem",
      scope,
      problem: {
        code: "admin-core/event-catalog-validation-source-failed",
        status: 503,
        title: "Event validation unavailable",
        retryable: true,
      },
    };
  }
  assertSourceScope(result?.scope, scope);
  if (result.kind === "not-found") {
    return {
      kind: "not-found",
      scope,
      delivery: "not-sent",
      problem: {
        code: "admin-core/event-catalog-version-not-found",
        status: 404,
        title: "Event version not found",
      },
    };
  }
  if (result.kind === "invalid") {
    return {
      kind: "invalid",
      scope,
      delivery: "not-sent",
      problem: {
        code: result.code,
        status: 400,
        title: "Event payload is invalid",
      },
    };
  }
  if (result.kind === "unsupported") {
    return unsupported(scope);
  }
  if (result.kind === "problem") {
    return { kind: "problem", scope, problem: result.problem };
  }
  if (result.kind === "valid") {
    return { kind: "valid", scope, delivery: "not-sent" };
  }
  return {
    kind: "problem",
    scope,
    problem: {
      code: "admin-core/event-catalog-validation-result-invalid",
      status: 502,
      title: "Event validation source returned an invalid result",
    },
  };
}

function scopeFrom(input: EventCatalogScope): EventCatalogScope {
  assertScope(input);
  return input.kind === "tenant"
    ? {
        kind: "tenant",
        tenantId: input.tenantId,
        appId: input.appId,
        environment: input.environment,
      }
    : { kind: "app", appId: input.appId, environment: input.environment };
}

function assertScope(
  scope: EventCatalogScope | null | undefined,
): asserts scope is EventCatalogScope {
  if (scope === null || scope === undefined || typeof scope !== "object") {
    throw new EventCatalogValidationProblem("scope", "invalid");
  }
  if (scope.kind !== "app" && scope.kind !== "tenant") {
    throw new EventCatalogValidationProblem("scope.kind", "invalid");
  }
  for (const field of ["appId", "environment"] as const) {
    if (typeof scope[field] !== "string" || !scope[field].trim()) {
      throw new EventCatalogValidationProblem(field);
    }
  }
  if (scope.kind === "tenant" && (typeof scope.tenantId !== "string" || !scope.tenantId.trim())) {
    throw new EventCatalogValidationProblem("tenantId");
  }
  if (scope.kind === "app" && "tenantId" in scope) {
    throw new EventCatalogValidationProblem("tenantId", "not allowed for app scope");
  }
}

function assertAccessInput(input: EventCatalogInput): void {
  if (!input.principalId?.trim()) {
    throw new EventCatalogValidationProblem("principalId");
  }
}

function permissionDenied(scope: EventCatalogScope, permission: string) {
  return {
    kind: "permission-denied" as const,
    scope,
    requiredPermissions: [permission],
    problem: {
      code: "admin-core/event-catalog-permission-denied",
      status: 403,
      title: "Event catalog permission denied",
      detail: `Missing ${permission} permission`,
    },
  };
}

async function loadScopedCatalog(
  input: EventCatalogInput,
  scope: EventCatalogScope,
): Promise<
  | { readonly kind: "ready"; readonly entries: readonly EventCatalogEntry[] }
  | {
      readonly kind: "partial";
      readonly entries: readonly EventCatalogEntry[];
      readonly problem: AdminProblemContract;
    }
  | {
      readonly kind: "unsupported";
      readonly scope: EventCatalogScope;
      readonly problem: AdminProblemContract;
    }
  | {
      readonly kind: "problem";
      readonly scope: EventCatalogScope;
      readonly problem: AdminProblemContract;
    }
> {
  let result: Awaited<ReturnType<EventCatalogSource["load"]>>;
  try {
    result = await input.source.load({
      scope,
      principalId: input.principalId,
      grantedPermissions: input.grantedPermissions,
      signal: input.signal,
    });
  } catch (caught) {
    if (input.signal?.aborted) {
      throw input.signal.reason ?? caught;
    }
    return {
      kind: "problem",
      scope,
      problem: {
        code: "admin-core/event-catalog-source-failed",
        status: 503,
        title: "Event catalog unavailable",
        retryable: true,
      },
    };
  }
  assertSourceScope(result?.scope, scope);
  if (result.kind === "unsupported") {
    return unsupported(scope);
  }
  if (result.kind === "problem") {
    return { kind: "problem", scope, problem: result.problem };
  }
  if (result.kind === "partial") {
    return { kind: "partial", entries: result.entries, problem: result.problem };
  }
  if (result.kind === "ready") {
    return { kind: "ready", entries: result.entries };
  }
  return {
    kind: "problem",
    scope,
    problem: {
      code: "admin-core/event-catalog-load-result-invalid",
      status: 502,
      title: "Event catalog source returned an invalid result",
    },
  };
}

function assertSourceScope(
  actual: EventCatalogScope | null | undefined,
  expected: EventCatalogScope,
): void {
  assertScope(actual);
  if (
    actual.kind !== expected.kind ||
    actual.appId !== expected.appId ||
    actual.environment !== expected.environment
  ) {
    throw new EventCatalogValidationProblem("source scope");
  }
  if (
    actual.kind === "tenant" &&
    expected.kind === "tenant" &&
    actual.tenantId !== expected.tenantId
  ) {
    throw new EventCatalogValidationProblem("source scope");
  }
}

function unsupported(scope: EventCatalogScope) {
  return {
    kind: "unsupported" as const,
    scope,
    problem: {
      code: "admin-core/event-catalog-unsupported",
      status: 501,
      title: "Event catalog is unsupported",
    },
  };
}
