import 'reflect-metadata';
import type { Constructor } from '@croco/framework-context';
import { Container, Context } from '@croco/framework-context';
import { Logger } from '@croco/framework-logger';
import type { CallHandler, ExecutionContext, Interceptor } from '@croco/protocols-rest';
import { AuditLogRepository } from './AuditLogRepository';
import { AUDIT_METADATA_KEY } from './constants';
import type { AuditLogEntry } from './types';

type HttpMetadata = {
  method: string;
  path: string;
  ip: string;
  body?: unknown;
};

type AuditableMetadata = {
  source?: string;
  [key: string]: unknown;
};

function readHeaderValue(
  headers: Headers | Record<string, string | undefined> | undefined,
  headerName: string
): string | undefined {
  if (!headers) {
    return undefined;
  }

  if ('get' in headers && typeof headers.get === 'function') {
    return headers.get(headerName) ?? undefined;
  }

  const headerRecord = headers as Record<string, string | undefined>;
  const direct = headerRecord[headerName];
  if (direct) {
    return direct;
  }

  const match = Object.entries(headerRecord).find(([key]) => key.toLowerCase() === headerName.toLowerCase());
  return match?.[1];
}

function extractIp(request: Request): string {
  const requestLike = request as unknown as {
    headers?: Headers | Record<string, string | undefined>;
    header?: Record<string, string | undefined> | ((name: string) => string | undefined);
  };

  const forwardedFor = readHeaderValue(requestLike.headers, 'x-forwarded-for');
  if (forwardedFor) {
    return forwardedFor.split(',')[0]?.trim() ?? 'unknown';
  }

  if (typeof requestLike.header === 'function') {
    return requestLike.header('x-real-ip') ?? 'unknown';
  }

  if (requestLike.header && typeof requestLike.header === 'object') {
    return requestLike.header['x-real-ip'] ?? 'unknown';
  }

  const realIp = readHeaderValue(requestLike.headers, 'x-real-ip');
  if (realIp) {
    return realIp;
  }

  return 'unknown';
}

function extractRequestBody(request: Request): unknown {
  const requestLike = request as unknown as { body?: unknown };
  return requestLike.body;
}

function toHttpMetadata(context: ExecutionContext): HttpMetadata {
  const request = context.getRequest();
  const method = context.getMethod();
  const path = context.getPath();
  const ip = extractIp(request);
  const body = extractRequestBody(request);

  const metadata: HttpMetadata = {
    method,
    path,
    ip,
  };

  if (body !== undefined) {
    metadata.body = body;
  }

  return metadata;
}

function mergeMetadata(existing: AuditableMetadata | undefined, http: HttpMetadata): AuditableMetadata {
  const safeExisting = existing && typeof existing === 'object' ? existing : {};

  return {
    ...safeExisting,
    http,
  };
}

function resolveAction(controllerName: string, handlerName: string | symbol): string {
  return `${controllerName}.${String(handlerName)}`;
}

function resolveResourceType(controllerName: string): string {
  return controllerName;
}

function resolveResourceId(path: string): string {
  return path;
}

function writeAuditLog(entry: Omit<AuditLogEntry, 'id' | 'createdAt'>): void {
  void Promise.resolve()
    .then(() => {
      const repository = Container.get(AuditLogRepository as unknown as Constructor<AuditLogRepository>);
      return repository.create(entry);
    })
    .catch((err: unknown) => {
      try {
        const logger = Container.get(Logger as unknown as Constructor<Logger>);
        logger.warn('Audit log write failed', { error: err instanceof Error ? err.message : String(err) });
      } catch {
        // Logger도 resolve 실패 시 무시
      }
      return undefined;
    });
}

export class AuditInterceptor implements Interceptor<ExecutionContext> {
  async intercept(context: ExecutionContext, next: CallHandler): Promise<unknown> {
    const target = context.getClass();
    const handler = context.getHandler();
    const http = toHttpMetadata(context);
    const existingMetadata = Reflect.getMetadata(AUDIT_METADATA_KEY, target, handler) as AuditableMetadata | undefined;

    if (existingMetadata) {
      return next.handle();
    }

    const contextData = Context.get();
    const controllerName = target.name || 'UnknownController';

    try {
      const result = await next.handle();

      writeAuditLog({
        tenantId: contextData?.tenantId ?? 'unknown',
        actorId: contextData?.user?.id ?? 'unknown',
        action: resolveAction(controllerName, handler),
        resourceType: resolveResourceType(controllerName),
        resourceId: resolveResourceId(http.path),
        payload: {
          result,
        },
        diff: null,
        metadata: mergeMetadata(existingMetadata, http),
      });

      return result;
    } catch (error) {
      writeAuditLog({
        tenantId: contextData?.tenantId ?? 'unknown',
        actorId: contextData?.user?.id ?? 'unknown',
        action: resolveAction(controllerName, handler),
        resourceType: resolveResourceType(controllerName),
        resourceId: resolveResourceId(http.path),
        payload: {
          error: error instanceof Error ? error.message : String(error),
        },
        diff: null,
        metadata: mergeMetadata(existingMetadata, http),
      });

      throw error;
    }
  }
}
