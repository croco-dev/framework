import type { Constructor } from '@croco/framework-context';
import { Container, Context } from '@croco/framework-context';
import { AuditLogRepository } from './AuditLogRepository';
import type { AuditableOptions, AuditLogEntry } from './types';

type DecoratedMethod = (...args: unknown[]) => unknown;

function extractParameterNames(method: DecoratedMethod): string[] {
  const source = method.toString().replace(/\n/g, ' ');
  const signatureMatch = source.match(/^[^(]*\(([^)]*)\)/);

  if (!signatureMatch) {
    return [];
  }

  return signatureMatch[1]
    .split(',')
    .map((name) => name.trim())
    .filter((name) => name.length > 0)
    .map((name) => name.replace(/=[\s\S]*$/, '').trim())
    .map((name) => name.replace(/^\.\.\./, '').trim());
}

function getArgumentByParamName(args: unknown[], parameterNames: string[], paramName?: string): unknown {
  if (!paramName) {
    return undefined;
  }

  const paramIndex = parameterNames.indexOf(paramName);
  if (paramIndex < 0) {
    return undefined;
  }

  return args[paramIndex];
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

function extractDiff(payload: unknown): Record<string, unknown> | null {
  if (!payload || typeof payload !== 'object' || !('diff' in payload)) {
    return null;
  }

  const diff = payload.diff;
  if (!diff || typeof diff !== 'object') {
    return null;
  }

  return diff as Record<string, unknown>;
}

function writeAuditLog(entry: Omit<AuditLogEntry, 'id' | 'createdAt'>): void {
  void Promise.resolve()
    .then(() => {
      const repository = Container.get(AuditLogRepository as unknown as Constructor<AuditLogRepository>);
      return repository.create(entry);
    })
    .catch(() => undefined);
}

export function Auditable(options: AuditableOptions): MethodDecorator {
  return (_target: object, _propertyKey: string | symbol, descriptor: PropertyDescriptor): PropertyDescriptor => {
    const originalMethod = descriptor.value as DecoratedMethod;

    if (typeof originalMethod !== 'function') {
      throw new Error('@Auditable can only be applied to methods');
    }

    const parameterNames = extractParameterNames(originalMethod);

    descriptor.value = async function (this: unknown, ...args: unknown[]): Promise<unknown> {
      const context = Context.get();
      const payloadInput = getArgumentByParamName(args, parameterNames, options.payloadParam);
      const resourceIdValue = getArgumentByParamName(args, parameterNames, options.resourceIdParam);
      const payload: Record<string, unknown> = {
        arguments: args,
      };

      if (payloadInput !== undefined) {
        payload.input = payloadInput;
      }

      const auditEntryBase: Omit<AuditLogEntry, 'id' | 'createdAt' | 'payload'> = {
        tenantId: context?.tenantId ?? 'unknown',
        actorId: context?.user?.id ?? 'unknown',
        action: options.action,
        resourceType: options.resourceType,
        resourceId: toResourceId(resourceIdValue, args),
        diff: extractDiff(payloadInput),
        metadata: {},
      };

      try {
        const result = await originalMethod.apply(this, args);

        if (options.includeResult ?? true) {
          payload.result = result;
        }

        writeAuditLog({
          ...auditEntryBase,
          payload,
        });

        return result;
      } catch (error) {
        payload.error = error instanceof Error ? error.message : String(error);

        writeAuditLog({
          ...auditEntryBase,
          payload,
        });

        throw error;
      }
    };

    return descriptor;
  };
}
