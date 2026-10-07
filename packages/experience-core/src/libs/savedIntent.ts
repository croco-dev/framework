import { Problem, ProblemCategory } from "@croco/problems-core";
import type {
  MutateSavedIntentInput,
  ResolvedCandidate,
  SavedIntent,
  SavedIntentAccess,
  SavedIntentAuthorization,
  SavedIntentExclusion,
  SavedIntentMutation,
  SavedIntentPolicy,
  SavedIntentResourceType,
  SavedIntentService,
  SavedIntentStore,
  SaveIntentInput,
} from "./savedIntentContracts";

export class SavedIntentInvalidProblem extends Problem {
  constructor(detail: string) {
    super("saved-intent/invalid", ProblemCategory.ValidationError, detail);
  }
}
export class SavedIntentConflictProblem extends Problem {
  constructor(detail: string) {
    super("saved-intent/conflict", ProblemCategory.Conflict, detail);
  }
}
export class SavedIntentDeniedProblem extends Problem {
  constructor(detail: string) {
    super("saved-intent/denied", ProblemCategory.Forbidden, detail);
  }
}
function object(value: unknown, keys: readonly string[]): asserts value is Record<string, unknown> {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    Object.keys(value).some((key) => !keys.includes(key))
  )
    throw new SavedIntentInvalidProblem("Unknown or invalid input fields");
}
function hasControl(value: string): boolean {
  return [...value].some(
    (character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127,
  );
}
function text(value: unknown): asserts value is string {
  if (typeof value !== "string" || !value.trim() || value.length > 512 || hasControl(value))
    throw new SavedIntentInvalidProblem("Expected nonempty bounded text");
}
function integer(value: unknown, min: number, max: number): asserts value is number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < min || value > max)
    throw new SavedIntentInvalidProblem("Integer outside allowed range");
}
function access(input: SavedIntentAccess): void {
  object(input.scope, ["appId", "environment", "tenantId"]);
  text(input.scope.appId);
  text(input.scope.environment);
  text(input.scope.tenantId);
  object(input.subject, ["kind", "id"]);
  text(input.subject.kind);
  text(input.subject.id);
  if (input.principal === null || input.principal === undefined)
    throw new SavedIntentDeniedProblem("Verified principal required");
}
const accessKeys = ["scope", "subject", "principal"];
const resourceKeys = [...accessKeys, "resourceType", "resourceId", "sourceKind"];
const mutationKeys = [...resourceKeys, "expectedRevision", "idempotencyKey"];
function revision(value: number | null): void {
  if (value !== null) integer(value, 1, Number.MAX_SAFE_INTEGER);
}
function policyValues(value: {
  displayLimit: number;
  retentionDays: number;
  excludeCompleted: boolean;
}): void {
  integer(value.displayLimit, 1, 100);
  integer(value.retentionDays, 1, 3650);
  if (typeof value.excludeCompleted !== "boolean")
    throw new SavedIntentInvalidProblem("excludeCompleted must be boolean");
}
/** Validate resolver URLs at the server boundary; relative paths stay on the application origin. */
export function validateSavedIntentUrl(value: string, allowedOrigins: readonly string[]): string {
  text(value);
  let decoded = value;
  for (let depth = 0; depth < 8; depth++) {
    if (/[\s\\]/.test(decoded) || hasControl(decoded) || decoded.startsWith("//"))
      throw new SavedIntentInvalidProblem("Unsafe resume URL");
    let next: string;
    try {
      next = decodeURIComponent(decoded);
    } catch {
      throw new SavedIntentInvalidProblem("Invalid URL encoding");
    }
    if (next === decoded) break;
    decoded = next;
    if (depth === 7) throw new SavedIntentInvalidProblem("Excessively encoded URL");
  }
  if (value.startsWith("/") && !value.startsWith("//")) return value;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new SavedIntentInvalidProblem("Invalid resume URL");
  }
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    !allowedOrigins.includes(url.origin)
  )
    throw new SavedIntentInvalidProblem("Resume URL origin is not allowed");
  return url.href;
}
export function createSavedIntentService(
  options: Readonly<{
    store: SavedIntentStore;
    resourceTypes: readonly SavedIntentResourceType[];
    authorize: SavedIntentAuthorization;
    now?: () => string;
    id?: () => string;
  }>,
): SavedIntentService {
  const types = new Map<string, SavedIntentResourceType>();
  for (const definition of options.resourceTypes) {
    object(definition, ["id", "resolver", "allowedOrigins", "defaultPolicy"]);
    text(definition.id);
    if (
      types.has(definition.id) ||
      typeof definition.resolver !== "function" ||
      !Array.isArray(definition.allowedOrigins)
    )
      throw new SavedIntentInvalidProblem("Invalid or duplicate resource type");
    object(definition.defaultPolicy, ["displayLimit", "retentionDays", "excludeCompleted"]);
    policyValues(definition.defaultPolicy);
    for (const origin of definition.allowedOrigins) {
      let url: URL;
      try {
        url = new URL(origin);
      } catch {
        throw new SavedIntentInvalidProblem("Invalid allowed origin");
      }
      if (url.protocol !== "https:" || url.origin !== origin)
        throw new SavedIntentInvalidProblem("Allowed origins must be HTTPS origins");
    }
    types.set(
      definition.id,
      Object.freeze({
        ...definition,
        allowedOrigins: Object.freeze([...definition.allowedOrigins]),
        defaultPolicy: Object.freeze({ ...definition.defaultPolicy }),
      }),
    );
  }
  const clock = (): string => {
    const value = options.now?.() ?? new Date().toISOString();
    if (!Number.isFinite(Date.parse(value))) throw new SavedIntentInvalidProblem("Invalid clock");
    return value;
  };
  const type = (id: string): SavedIntentResourceType => {
    text(id);
    const definition = types.get(id);
    if (!definition) throw new SavedIntentInvalidProblem("Unknown resource type");
    return definition;
  };
  const authorize = async (
    input: SavedIntentAccess,
    action: Parameters<SavedIntentAuthorization>[0]["action"],
    actorId?: string,
  ) => {
    access(input);
    if (
      !(await options.authorize({
        scope: input.scope,
        subject: input.subject,
        principal: input.principal,
        action,
        ...(actorId ? { actorId } : {}),
      }))
    )
      throw new SavedIntentDeniedProblem("Saved intent access denied");
  };
  const policy = async (
    input: SavedIntentAccess,
    resourceType: string,
  ): Promise<SavedIntentPolicy> => {
    const definition = type(resourceType);
    return (
      (await options.store.readPolicy({ scope: input.scope, resourceType })) ?? {
        scope: input.scope,
        resourceType,
        ...definition.defaultPolicy,
        revision: 0,
        actorId: "code",
        reason: "Declared default",
        updatedAt: "1970-01-01T00:00:00.000Z",
      }
    );
  };
  const rows = async (input: SavedIntentAccess) => {
    const result = await options.store.list({
      scope: input.scope,
      subject: input.subject,
      offset: 0,
      limit: 10001,
    });
    if (result.length > 10000)
      throw new SavedIntentInvalidProblem(
        "Subject intent capacity exceeded; purge retention before listing",
      );
    return result;
  };
  const resource = (input: { resourceType: string; resourceId: string; sourceKind: string }) => {
    type(input.resourceType);
    text(input.resourceId);
    if (input.sourceKind !== "explicit" && input.sourceKind !== "recent")
      throw new SavedIntentInvalidProblem("Invalid sourceKind");
  };
  const mutate = async (
    input: SaveIntentInput | (MutateSavedIntentInput & { pinOrder?: number | null }),
    operation: SavedIntentMutation["operation"],
  ) => {
    object(input, [
      ...mutationKeys,
      ...(operation === "save" ? ["progressRef"] : operation === "pin" ? ["pinOrder"] : []),
    ]);
    resource(input);
    revision(input.expectedRevision);
    text(input.idempotencyKey);
    if ("progressRef" in input && input.progressRef !== undefined) text(input.progressRef);
    if (operation === "pin") {
      if (!("pinOrder" in input)) throw new SavedIntentInvalidProblem("pinOrder required");
      if (input.pinOrder !== null) integer(input.pinOrder, 0, 10000);
    }
    await authorize(input, "write");
    const id = options.id?.() ?? globalThis.crypto.randomUUID();
    text(id);
    const stored = await options.store.mutate({
      scope: input.scope,
      subject: input.subject,
      resourceType: input.resourceType,
      resourceId: input.resourceId,
      sourceKind: input.sourceKind,
      expectedRevision: input.expectedRevision,
      idempotencyKey: input.idempotencyKey,
      operation,
      id,
      now: clock(),
      ...("progressRef" in input && input.progressRef !== undefined
        ? { progressRef: input.progressRef }
        : {}),
      ...("pinOrder" in input ? { pinOrder: input.pinOrder } : {}),
    });
    const { progressRef: _progress, ...metadata } = stored;
    return metadata;
  };
  const resolve = async (
    input: SavedIntentAccess,
    intent: SavedIntent,
    retained: boolean,
  ): Promise<ResolvedCandidate> => {
    const rankReason = intent.pinOrder === undefined ? "recent" : "pinned";
    const { progressRef: _progress, ...redacted } = intent;
    if (!retained) return { intent: redacted, availability: "expired", rankReason };
    const definition = type(intent.resourceType);
    const result = await definition.resolver({
      scope: input.scope,
      subject: input.subject,
      principal: input.principal,
      resourceType: intent.resourceType,
      resourceId: intent.resourceId,
    });
    if (!["available", "deleted", "denied", "expired"].includes(result.availability))
      throw new SavedIntentInvalidProblem("Invalid resolver availability");
    if (result.availability !== "available")
      return { intent: redacted, availability: result.availability, rankReason };
    text(result.label);
    return {
      intent,
      availability: "available",
      label: result.label,
      safeUrl: validateSavedIntentUrl(result.safeUrl, definition.allowedOrigins),
      rankReason,
    };
  };
  return {
    saveIntent: (input) => mutate(input, "save"),
    removeIntent: (input) => mutate(input, "remove"),
    markCompleted: (input) => mutate(input, "complete"),
    pinIntent: (input) => mutate(input, "pin"),
    async readPolicy(input) {
      object(input, [...accessKeys, "resourceType"]);
      type(input.resourceType);
      await authorize(input, "policy:read");
      return policy(input, input.resourceType);
    },
    async updatePolicy(input) {
      object(input, [
        ...accessKeys,
        "resourceType",
        "displayLimit",
        "retentionDays",
        "excludeCompleted",
        "expectedRevision",
        "idempotencyKey",
        "actorId",
        "reason",
      ]);
      type(input.resourceType);
      policyValues(input);
      revision(input.expectedRevision);
      text(input.actorId);
      text(input.reason);
      text(input.idempotencyKey);
      await authorize(input, "policy:write", input.actorId);
      return options.store.updatePolicy({
        policy: {
          scope: input.scope,
          resourceType: input.resourceType,
          displayLimit: input.displayLimit,
          retentionDays: input.retentionDays,
          excludeCompleted: input.excludeCompleted,
          actorId: input.actorId,
          reason: input.reason,
          revision: (input.expectedRevision ?? 0) + 1,
          updatedAt: clock(),
        },
        expectedRevision: input.expectedRevision,
        idempotencyKey: input.idempotencyKey,
      });
    },
    async listResumeCandidates(input) {
      object(input, [...accessKeys, "offset", "limit", "includeExclusions"]);
      const offset = input.offset ?? 0;
      const limit = input.limit ?? 20;
      integer(offset, 0, 10000);
      integer(limit, 1, 100);
      if (input.includeExclusions !== undefined && typeof input.includeExclusions !== "boolean")
        throw new SavedIntentInvalidProblem("Invalid includeExclusions");
      await authorize(input, "read");
      if (input.includeExclusions) await authorize(input, "inspect");
      const all = [...(await rows(input))];
      const policies = new Map<string, SavedIntentPolicy>();
      for (const row of all)
        if (!policies.has(row.resourceType))
          policies.set(row.resourceType, await policy(input, row.resourceType));
      all.sort(
        (a, b) =>
          (a.pinOrder ?? Infinity) - (b.pinOrder ?? Infinity) ||
          Date.parse(b.lastUsedAt) - Date.parse(a.lastUsedAt) ||
          (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
      );
      const now = Date.parse(clock());
      const explicit = new Set(
        all
          .filter((row) => {
            const settings = policies.get(row.resourceType);
            if (!settings) throw new SavedIntentInvalidProblem("Missing resource policy");
            return (
              row.sourceKind === "explicit" &&
              row.state !== "removed" &&
              now - Date.parse(row.lastUsedAt) < settings.retentionDays * 86400000
            );
          })
          .map((row) => JSON.stringify([row.resourceType, row.resourceId])),
      );
      const counts = new Map<string, number>();
      const selected: SavedIntent[] = [];
      const exclusions: SavedIntentExclusion[] = [];
      for (const row of all) {
        const settings = policies.get(row.resourceType);
        if (!settings) throw new SavedIntentInvalidProblem("Missing resource policy");
        const key = JSON.stringify([row.resourceType, row.resourceId]);
        const reason =
          row.state === "removed"
            ? "removed"
            : row.state === "completed" && settings.excludeCompleted
              ? "completed"
              : now - Date.parse(row.lastUsedAt) >= settings.retentionDays * 86400000
                ? "retention"
                : row.sourceKind === "recent" && explicit.has(key)
                  ? "duplicate"
                  : (counts.get(row.resourceType) ?? 0) >= settings.displayLimit
                    ? "display-limit"
                    : undefined;
        if (reason) {
          exclusions.push({ intentId: row.id, resourceType: row.resourceType, reason });
          continue;
        }
        counts.set(row.resourceType, (counts.get(row.resourceType) ?? 0) + 1);
        selected.push(row);
      }
      const candidates = await Promise.all(
        selected.slice(offset, offset + limit).map((row) => resolve(input, row, true)),
      );
      return {
        candidates,
        exclusions: input.includeExclusions ? exclusions.slice(offset, offset + limit) : [],
        ...(offset + limit <
        (input.includeExclusions ? Math.max(selected.length, exclusions.length) : selected.length)
          ? { nextOffset: offset + limit }
          : {}),
      };
    },
    async readIntent(input) {
      object(input, resourceKeys);
      resource(input);
      await authorize(input, "read");
      const intent = await options.store.read({
        scope: input.scope,
        subject: input.subject,
        resourceType: input.resourceType,
        resourceId: input.resourceId,
        sourceKind: input.sourceKind,
      });
      if (!intent) return undefined;
      const { progressRef: _progress, ...metadata } = intent;
      return metadata;
    },
    async resolveIntent(input) {
      object(input, resourceKeys);
      resource(input);
      await authorize(input, "read");
      const intent = await options.store.read({
        scope: input.scope,
        subject: input.subject,
        resourceType: input.resourceType,
        resourceId: input.resourceId,
        sourceKind: input.sourceKind,
      });
      if (!intent || intent.state === "removed")
        throw new SavedIntentDeniedProblem("Saved intent unavailable");
      const settings = await policy(input, input.resourceType);
      if (intent.state === "completed" && settings.excludeCompleted)
        throw new SavedIntentDeniedProblem("Saved intent completed");
      return resolve(
        input,
        intent,
        Date.parse(clock()) - Date.parse(intent.lastUsedAt) < settings.retentionDays * 86400000,
      );
    },
    async purgeRetention(input) {
      object(input, accessKeys);
      await authorize(input, "retention:purge");
      const now = Date.parse(clock());
      for (const resourceType of types.keys()) {
        const settings = await policy(input, resourceType);
        await options.store.purgeExpired({
          scope: input.scope,
          subject: input.subject,
          resourceType,
          before: new Date(now - settings.retentionDays * 86400000).toISOString(),
        });
      }
    },
    async deleteSubject(input) {
      object(input, accessKeys);
      await authorize(input, "privacy:delete");
      await options.store.deleteSubject({ scope: input.scope, subject: input.subject });
    },
  };
}
