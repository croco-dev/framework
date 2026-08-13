import { Container, Context, type ILogger, LOGGER_TOKEN } from "@croco/framework-context";
import { recordError } from "@croco/telemetry-api";
import type { AuditLogRepository } from "./AuditLogRepository";
import { AUDIT_LOG_REPOSITORY_TOKEN } from "./AuditLogRepositoryToken";
import { AuditableDecoratorProblem } from "./problems/AuditableDecoratorProblem";
import { sanitizeAuditValue } from "./sanitizeAuditValue";
import type { AuditableOptions, AuditLogEntry } from "./types";

type DecoratedMethod = (...args: unknown[]) => unknown;

type ImpersonationContext = {
  impersonatorId: string;
  targetUserId: string;
};

function getImpersonationContext(context: unknown): ImpersonationContext | undefined {
  if (!context || typeof context !== "object") {
    return undefined;
  }

  const ctx = context as Record<string, unknown>;
  if (!("impersonation" in ctx)) {
    return undefined;
  }

  const impersonation = ctx.impersonation;
  if (!impersonation || typeof impersonation !== "object") {
    return undefined;
  }

  const imp = impersonation as Record<string, unknown>;
  if (typeof imp.impersonatorId !== "string" || typeof imp.targetUserId !== "string") {
    return undefined;
  }

  return {
    impersonatorId: imp.impersonatorId,
    targetUserId: imp.targetUserId,
  };
}

function extractDiffFromPayload(payload: unknown): Record<string, unknown> | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  let descriptor: PropertyDescriptor | undefined;
  try {
    descriptor = Object.getOwnPropertyDescriptor(payload, "diff");
  } catch {
    return null;
  }

  if (!descriptor || !("value" in descriptor)) {
    return null;
  }

  const diff = descriptor.value;
  if (!diff || typeof diff !== "object") {
    return null;
  }

  const sanitized = sanitizeAuditValue(diff);
  if (!sanitized || typeof sanitized !== "object" || Array.isArray(sanitized)) {
    return null;
  }
  return sanitized as Record<string, unknown>;
}

function toResourceId(value: unknown, args: unknown[]): string {
  if (value !== undefined && value !== null) {
    return String(value);
  }

  const firstArgument = args[0];
  if (firstArgument !== undefined && firstArgument !== null) {
    return String(firstArgument);
  }

  return "unknown";
}

function buildAuditPayload(
  args: unknown[],
  payloadInput: unknown,
  result: unknown,
  errorMessage: string | null,
  includeResult: boolean,
): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    arguments: sanitizeAuditValue(args),
  };

  if (payloadInput !== undefined) {
    payload.input = sanitizeAuditValue(payloadInput);
  }

  if (includeResult && errorMessage === null) {
    payload.result = sanitizeAuditValue(result);
  }

  if (errorMessage !== null) {
    payload.error = sanitizeAuditValue(errorMessage);
  }

  return payload;
}

function getErrorMessage(error: unknown): string {
  try {
    return error instanceof Error ? error.message : String(error);
  } catch {
    return "[Unserializable]";
  }
}

type AuditWriteConfig = {
  tenantId: string;
  actorId: string;
  action: string;
  resourceType: string;
  resourceId: string;
  diff: Record<string, unknown> | null;
  metadata: Record<string, unknown>;
  throwOnError?: boolean;
};

type AuditWriteDependencies = {
  repository: AuditLogRepository;
  logger: ILogger;
};

function safelyRecordError(error: unknown): void {
  try {
    recordError(error);
  } catch {
    return;
  }
}

function safelyWarn(logger: ILogger, message: string, metadata: Record<string, unknown>): void {
  try {
    logger.warn(message, metadata);
  } catch {
    return;
  }
}

function resolveAuditWriteDependencies(): AuditWriteDependencies | undefined {
  try {
    const [repository, logger] = Container.getMany([AUDIT_LOG_REPOSITORY_TOKEN, LOGGER_TOKEN]) as [
      AuditLogRepository,
      ILogger,
    ];

    return { repository, logger };
  } catch (error) {
    safelyRecordError(error);
    return undefined;
  }
}

async function writeAuditLog(
  config: AuditWriteConfig,
  payload: Record<string, unknown>,
  dependencies: AuditWriteDependencies,
): Promise<void> {
  const entry: Omit<AuditLogEntry, "id" | "createdAt"> = {
    tenantId: config.tenantId,
    actorId: config.actorId,
    action: config.action,
    resourceType: config.resourceType,
    resourceId: config.resourceId,
    payload,
    diff: config.diff,
    metadata: config.metadata,
  };

  try {
    await dependencies.repository.create(entry);
  } catch (error) {
    safelyRecordError(error);
    safelyWarn(dependencies.logger, "[Auditable] Failed to write audit log", {
      error: error instanceof Error ? error.message : String(error),
    });

    if (config.throwOnError) {
      throw error;
    }
  }
}

export const AUDIT_PARAM_KEY = Symbol("audit:param");

export type AuditParamMetadata = {
  resourceIdIndex?: number;
  payloadIndex?: number;
};

export function Auditable(options: AuditableOptions): MethodDecorator {
  return (
    target: object,
    propertyKey: string | symbol,
    descriptor: PropertyDescriptor,
  ): PropertyDescriptor => {
    const originalMethod = descriptor.value as DecoratedMethod;

    if (typeof originalMethod !== "function") {
      throw new AuditableDecoratorProblem("@Auditable can only be applied to methods");
    }

    const paramMetadata: AuditParamMetadata = {
      resourceIdIndex: options.resourceIdParam !== undefined ? 0 : undefined,
      payloadIndex: options.payloadParam !== undefined ? 1 : undefined,
    };

    Reflect.defineMetadata(AUDIT_PARAM_KEY, paramMetadata, target, propertyKey);

    descriptor.value = async function (this: unknown, ...args: unknown[]): Promise<unknown> {
      const context = Context.get();
      const dependencies = resolveAuditWriteDependencies();
      const payloadInput =
        paramMetadata.payloadIndex !== undefined ? args[paramMetadata.payloadIndex] : undefined;
      const resourceIdValue =
        paramMetadata.resourceIdIndex !== undefined
          ? args[paramMetadata.resourceIdIndex]
          : undefined;
      const impersonation = getImpersonationContext(context);

      const auditConfig: AuditWriteConfig = {
        tenantId: context?.tenantId ?? "unknown",
        actorId: impersonation?.impersonatorId ?? context?.user?.id ?? "unknown",
        action: options.action,
        resourceType: options.resourceType,
        resourceId: toResourceId(resourceIdValue, args),
        diff: extractDiffFromPayload(payloadInput),
        metadata: impersonation
          ? {
              impersonation: true,
              impersonatorId: impersonation.impersonatorId,
              targetUserId: impersonation.targetUserId,
            }
          : {},
        throwOnError: options.throwOnFailure,
      };

      let result: unknown;
      try {
        result = await originalMethod.apply(this, args);
      } catch (error) {
        const payload = buildAuditPayload(args, payloadInput, null, getErrorMessage(error), false);
        if (dependencies) {
          if (options.throwOnFailure) {
            await writeAuditLog(auditConfig, payload, dependencies);
          } else {
            void writeAuditLog(auditConfig, payload, dependencies);
          }
        }

        throw error;
      }

      const payload = buildAuditPayload(
        args,
        payloadInput,
        result,
        null,
        options.includeResult ?? false,
      );
      if (dependencies) {
        if (options.throwOnFailure) {
          await writeAuditLog(auditConfig, payload, dependencies);
        } else {
          void writeAuditLog(auditConfig, payload, dependencies);
        }
      }

      return result;
    };

    return descriptor;
  };
}
