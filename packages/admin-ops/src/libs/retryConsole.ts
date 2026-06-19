import type {
  RetryConsole,
  RetryConsoleItem,
  RetryConsoleListOptions,
  RetryConsoleProblemMetadata,
  RetryConsoleRecoveryAction,
  RetryConsoleRecoveryInput,
  RetryConsoleRecoveryResult,
  RetryConsoleSource,
} from "./types";

const UNKNOWN_PROBLEM_CODE = "admin-ops/unknown-recovery-failure";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(value: Record<string, unknown>, key: string): string | undefined {
  const candidate = value[key];
  return typeof candidate === "string" && candidate.length > 0 ? candidate : undefined;
}

function readNumber(value: Record<string, unknown>, key: string): number | undefined {
  const candidate = value[key];
  return typeof candidate === "number" ? candidate : undefined;
}

function readBoolean(value: Record<string, unknown>, key: string): boolean | undefined {
  const candidate = value[key];
  return typeof candidate === "boolean" ? candidate : undefined;
}

function readExtensions(value: Record<string, unknown>): Record<string, unknown> | undefined {
  const reserved = new Set([
    "code",
    "message",
    "title",
    "status",
    "type",
    "detail",
    "retryable",
    "stack",
    "name",
  ]);
  const extensions = Object.fromEntries(
    Object.entries(value).filter(([key]) => !reserved.has(key)),
  );

  return Object.keys(extensions).length > 0 ? extensions : undefined;
}

export function normalizeProblemMetadata(
  error: unknown,
  fallbackCode = UNKNOWN_PROBLEM_CODE,
): RetryConsoleProblemMetadata {
  if (isRecord(error) && typeof error.toJSON === "function") {
    return normalizeProblemMetadata(error.toJSON(), fallbackCode);
  }

  if (error instanceof Error) {
    const record = error as Error & Record<string, unknown>;
    return {
      code: readString(record, "code") ?? fallbackCode,
      message: error.message,
      title: readString(record, "title"),
      status: readNumber(record, "status"),
      type: readString(record, "type"),
      detail: readString(record, "detail"),
      retryable: readBoolean(record, "retryable"),
      stack: error.stack,
      extensions: readExtensions(record),
    };
  }

  if (isRecord(error)) {
    return {
      code: readString(error, "code") ?? fallbackCode,
      message: readString(error, "message") ?? readString(error, "detail") ?? "Unknown failure",
      title: readString(error, "title"),
      status: readNumber(error, "status"),
      type: readString(error, "type"),
      detail: readString(error, "detail"),
      retryable: readBoolean(error, "retryable"),
      stack: readString(error, "stack"),
      extensions: readExtensions(error),
    };
  }

  return {
    code: fallbackCode,
    message: typeof error === "string" && error.length > 0 ? error : "Unknown failure",
  };
}

function matchesListOptions(item: RetryConsoleItem, options: RetryConsoleListOptions): boolean {
  if (options.states && !options.states.includes(item.state)) {
    return false;
  }

  if (options.sourceKinds && !options.sourceKinds.includes(item.source.kind)) {
    return false;
  }

  if (!options.includeSucceeded && item.state === "succeeded") {
    return false;
  }

  return true;
}

function sortByNewest(items: readonly RetryConsoleItem[]): readonly RetryConsoleItem[] {
  return [...items].sort((left, right) => {
    const leftTimestamp =
      left.timestamps.completedAt ?? left.timestamps.startedAt ?? left.timestamps.createdAt;
    const rightTimestamp =
      right.timestamps.completedAt ?? right.timestamps.startedAt ?? right.timestamps.createdAt;

    return (rightTimestamp ?? "").localeCompare(leftTimestamp ?? "");
  });
}

function findAction(
  item: RetryConsoleItem,
  request: RetryConsoleRecoveryInput,
): RetryConsoleRecoveryAction | undefined {
  if (request.actionId) {
    return item.recoveryActions.find((action) => action.id === request.actionId);
  }

  if (request.actionKind) {
    return item.recoveryActions.find((action) => action.kind === request.actionKind);
  }

  return undefined;
}

function createDeniedResult(
  item: RetryConsoleItem | undefined,
  action: RetryConsoleRecoveryAction | undefined,
  message: string,
  code = "admin-ops/recovery-denied",
): RetryConsoleRecoveryResult {
  return {
    status: "denied",
    item,
    action,
    problem: {
      code,
      message,
      retryable: false,
    },
  };
}

function permissionMatchesAction(
  action: RetryConsoleRecoveryAction,
  request: RetryConsoleRecoveryInput,
): boolean {
  const descriptor = request.permission.descriptor;
  if (!descriptor) {
    return false;
  }

  return (
    descriptor.action === action.permission.action &&
    descriptor.resource === action.permission.resource &&
    descriptor.scope === action.permission.scope
  );
}

function validateActionSelector(
  item: RetryConsoleItem,
  request: RetryConsoleRecoveryInput,
): RetryConsoleRecoveryResult | null {
  const hasActionId = request.actionId !== undefined;
  const hasActionKind = request.actionKind !== undefined;

  if (hasActionId === hasActionKind) {
    return createDeniedResult(
      item,
      undefined,
      "Recovery request must select exactly one action by id or kind",
      "admin-ops/recovery-action-selector-required",
    );
  }

  return null;
}

function validateRecoveryRequest(
  item: RetryConsoleItem,
  action: RetryConsoleRecoveryAction | undefined,
  request: RetryConsoleRecoveryInput,
): RetryConsoleRecoveryResult | null {
  if (!action) {
    return createDeniedResult(
      item,
      undefined,
      `No recovery action is available for '${item.id}'`,
      "admin-ops/recovery-action-not-found",
    );
  }

  if (!action.allowed) {
    return createDeniedResult(item, action, action.reason);
  }

  if (!request.permission.granted) {
    return createDeniedResult(
      item,
      action,
      request.permission.deniedReason ?? "Operator is not permitted to run this recovery action",
      "admin-ops/recovery-permission-denied",
    );
  }

  if (!permissionMatchesAction(action, request)) {
    return createDeniedResult(
      item,
      action,
      "Recovery permission descriptor does not match the selected action",
      "admin-ops/recovery-permission-descriptor-mismatch",
    );
  }

  if (!request.audit.actorId || !request.audit.reason) {
    return createDeniedResult(
      item,
      action,
      "Recovery action requires an audit actor and reason",
      "admin-ops/recovery-audit-required",
    );
  }

  if (action.requiresIdempotencyKey && !request.audit.idempotencyKey) {
    return createDeniedResult(
      item,
      action,
      "Recovery action requires an audit idempotency key",
      "admin-ops/recovery-idempotency-required",
    );
  }

  return null;
}

export function createRetryConsole(sources: readonly RetryConsoleSource[]): RetryConsole {
  const recoveryResults = new Map<string, Promise<RetryConsoleRecoveryResult>>();

  async function list(options: RetryConsoleListOptions = {}): Promise<readonly RetryConsoleItem[]> {
    const sourceItems = await Promise.all(sources.map((source) => source.list(options)));
    return sortByNewest(sourceItems.flat().filter((item) => matchesListOptions(item, options)));
  }

  async function findItem(
    itemId: string,
  ): Promise<{ readonly source: RetryConsoleSource; readonly item: RetryConsoleItem } | null> {
    for (const source of sources) {
      const item = (await source.list({ includeSucceeded: true })).find(
        (candidate) => candidate.id === itemId,
      );

      if (item) {
        return { source, item };
      }
    }

    return null;
  }

  function recoveryResultKey(
    item: RetryConsoleItem,
    action: RetryConsoleRecoveryAction,
    request: RetryConsoleRecoveryInput,
  ): string {
    return [item.source.kind, item.id, action.id, request.audit.idempotencyKey].join(":");
  }

  async function runRecovery(
    source: RetryConsoleSource,
    item: RetryConsoleItem,
    action: RetryConsoleRecoveryAction,
    request: RetryConsoleRecoveryInput,
  ): Promise<RetryConsoleRecoveryResult> {
    try {
      const result = await source.recover(item, request, action);
      return {
        status: "succeeded",
        action,
        item: result.item ?? item,
        audit: request.audit,
        providerResult: result.providerResult,
      };
    } catch (error) {
      return {
        status: "failed",
        action,
        item,
        problem: normalizeProblemMetadata(error, "admin-ops/provider-recovery-failed"),
      };
    }
  }

  return {
    list,

    async show(itemId: string): Promise<RetryConsoleItem | null> {
      return (await findItem(itemId))?.item ?? null;
    },

    async recover(request: RetryConsoleRecoveryInput): Promise<RetryConsoleRecoveryResult> {
      const found = await findItem(request.itemId);

      if (!found) {
        return createDeniedResult(
          undefined,
          undefined,
          `Retry console item '${request.itemId}' was not found`,
          "admin-ops/recovery-item-not-found",
        );
      }

      const selectorValidation = validateActionSelector(found.item, request);
      if (selectorValidation) {
        return selectorValidation;
      }

      const action = findAction(found.item, request);
      const validation = validateRecoveryRequest(found.item, action, request);
      if (validation) {
        return validation;
      }

      if (!action) {
        return createDeniedResult(
          found.item,
          undefined,
          `No recovery action is available for '${found.item.id}'`,
          "admin-ops/recovery-action-not-found",
        );
      }

      if (action.requiresIdempotencyKey) {
        const key = recoveryResultKey(found.item, action, request);
        const existingResult = recoveryResults.get(key);
        if (existingResult) {
          return existingResult;
        }

        const result = runRecovery(found.source, found.item, action, request);
        recoveryResults.set(key, result);
        return result;
      }

      return runRecovery(found.source, found.item, action, request);
    },
  };
}
