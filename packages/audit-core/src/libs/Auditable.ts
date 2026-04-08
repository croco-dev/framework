import { Container, Context, LOGGER_TOKEN } from '@croco/framework-context';
import { recordError } from '@croco/telemetry-api';
import { AUDIT_LOG_REPOSITORY_TOKEN } from './AuditLogRepositoryToken';
import { AuditableDecoratorProblem } from './problems/AuditableDecoratorProblem';
import type { AuditableOptions, AuditLogEntry } from './types';

type DecoratedMethod = (...args: unknown[]) => unknown;

type ImpersonationContext = {
  impersonatorId: string;
  targetUserId: string;
};

function getImpersonationContext(context: unknown): ImpersonationContext | undefined {
  if (!context || typeof context !== 'object') {
    return undefined;
  }

  const ctx = context as Record<string, unknown>;
  if (!('impersonation' in ctx)) {
    return undefined;
  }

  const impersonation = ctx.impersonation;
  if (!impersonation || typeof impersonation !== 'object') {
    return undefined;
  }

  const imp = impersonation as Record<string, unknown>;
  if (typeof imp.impersonatorId !== 'string' || typeof imp.targetUserId !== 'string') {
    return undefined;
  }

  return {
    impersonatorId: imp.impersonatorId,
    targetUserId: imp.targetUserId,
  };
}

function extractDiffFromPayload(payload: unknown): Record<string, unknown> | null {
  if (!payload || typeof payload !== 'object' || !('diff' in payload)) {
    return null;
  }

  const diff = payload.diff;
  if (!diff || typeof diff !== 'object') {
    return null;
  }

  return diff as Record<string, unknown>;
}

function toResourceId(value: unknown, args: unknown[]): string {
  if (value !== undefined && value !== null) {
    return String(value);
  }

  const firstArgument = args[0];
  if (firstArgument !== undefined && firstArgument !== null) {
    return String(firstArgument);
  }

  return 'unknown';
}

function buildAuditPayload(
  args: unknown[],
  payloadInput: unknown,
  result: unknown,
  error: Error | null,
  includeResult: boolean
): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    arguments: args,
  };

  if (payloadInput !== undefined) {
    payload.input = payloadInput;
  }

  if (includeResult && error === null) {
    payload.result = result;
  }

  if (error !== null) {
    payload.error = error.message;
  }

  return payload;
}

type AuditWriteConfig = {
  tenantId: string;
  actorId: string;
  action: string;
  resourceType: string;
  resourceId: string;
  diff: Record<string, unknown> | null;
  metadata: Record<string, unknown>;
};

function writeAuditLog(config: AuditWriteConfig, payload: Record<string, unknown>): void {
  const entry: Omit<AuditLogEntry, 'id' | 'createdAt'> = {
    tenantId: config.tenantId,
    actorId: config.actorId,
    action: config.action,
    resourceType: config.resourceType,
    resourceId: config.resourceId,
    payload,
    diff: config.diff,
    metadata: config.metadata,
  };

  void Promise.resolve()
    .then(() => {
      const repository = Container.get(AUDIT_LOG_REPOSITORY_TOKEN);
      return repository.create(entry);
    })
    .catch((error) => {
      try {
        recordError(error);
        const logger = Container.get(LOGGER_TOKEN);
        logger.warn('[Auditable] Failed to write audit log', {
          error: error instanceof Error ? error.message : String(error),
        });
      } catch {
        // Empty catch block intentionally suppresses secondary errors in audit logging
        // eslint-disable-next-line no-empty
      }
    });
}

export const AUDIT_PARAM_KEY = Symbol('audit:param');

export type AuditParamMetadata = {
  resourceIdIndex?: number;
  payloadIndex?: number;
};

export function Auditable(options: AuditableOptions): MethodDecorator {
  return (target: object, propertyKey: string | symbol, descriptor: PropertyDescriptor): PropertyDescriptor => {
    const originalMethod = descriptor.value as DecoratedMethod;

    if (typeof originalMethod !== 'function') {
      throw new AuditableDecoratorProblem('@Auditable can only be applied to methods');
    }

    const paramMetadata: AuditParamMetadata = {
      resourceIdIndex: options.resourceIdParam !== undefined ? 0 : undefined,
      payloadIndex: options.payloadParam !== undefined ? 1 : undefined,
    };

    Reflect.defineMetadata(AUDIT_PARAM_KEY, paramMetadata, target, propertyKey);

    descriptor.value = async function (this: unknown, ...args: unknown[]): Promise<unknown> {
      const context = Context.get();
      const payloadInput = paramMetadata.payloadIndex !== undefined ? args[paramMetadata.payloadIndex] : undefined;
      const resourceIdValue =
        paramMetadata.resourceIdIndex !== undefined ? args[paramMetadata.resourceIdIndex] : undefined;
      const impersonation = getImpersonationContext(context);

      const auditConfig: AuditWriteConfig = {
        tenantId: context?.tenantId ?? 'unknown',
        actorId: impersonation?.impersonatorId ?? context?.user?.id ?? 'unknown',
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
      };

      try {
        const result = await originalMethod.apply(this, args);

        const payload = buildAuditPayload(args, payloadInput, result, null, options.includeResult ?? true);
        writeAuditLog(auditConfig, payload);

        return result;
      } catch (error) {
        const errorObj = error instanceof Error ? error : new Error(String(error));
        const payload = buildAuditPayload(args, payloadInput, null, errorObj, false);
        writeAuditLog(auditConfig, payload);

        throw error;
      }
    };

    return descriptor;
  };
}
