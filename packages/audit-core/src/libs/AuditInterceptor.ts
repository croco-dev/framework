import "reflect-metadata";
import { Context } from "@croco/framework-context";
import type { AuditLogRepository } from "./AuditLogRepository";
import { AUDIT_METADATA_KEY } from "./constants";
import type { AuditExecutionContext, CallHandler, Interceptor } from "./interfaces/Interceptor";
import type { AuditLogEntry } from "./types";

type RequestHeaders = Headers | Record<string, string | undefined>;

type HeaderValue = string | undefined;

type RequestLike = {
  headers?: RequestHeaders;
  header?: Record<string, string | undefined> | ((name: string) => string | undefined);
  body?: unknown;
};

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

function isHeadersInstance(headers: unknown): headers is Headers {
  return headers instanceof Headers;
}

function hasGetMethod(headers: unknown): boolean {
  return typeof (headers as { get?: unknown }).get === "function";
}

function readHeaderValue(headers: RequestHeaders | undefined, headerName: string): HeaderValue {
  if (!headers) {
    return undefined;
  }

  if (isHeadersInstance(headers)) {
    return headers.get(headerName) ?? undefined;
  }

  if (hasGetMethod(headers)) {
    const getter = (headers as unknown as { get(name: string): string | null }).get;
    const result = getter(headerName);
    if (typeof result === "string") {
      return result;
    }
  }

  const headerRecord = headers as Record<string, string | undefined>;
  const direct = headerRecord[headerName];
  if (direct) {
    return direct;
  }

  const match = Object.entries(headerRecord).find(
    ([key]) => key.toLowerCase() === headerName.toLowerCase(),
  );
  return match?.[1];
}

function extractIp(request: Request): string {
  const requestLike = request as RequestLike;

  const forwardedFor = readHeaderValue(requestLike.headers, "x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() ?? "unknown";
  }

  if (typeof requestLike.header === "function") {
    return requestLike.header("x-real-ip") ?? "unknown";
  }

  if (requestLike.header && typeof requestLike.header === "object") {
    return requestLike.header["x-real-ip"] ?? "unknown";
  }

  const realIp = readHeaderValue(requestLike.headers, "x-real-ip");
  if (realIp) {
    return realIp;
  }

  return "unknown";
}

function extractRequestBody(request: Request): unknown {
  const requestLike = request as RequestLike;
  return requestLike.body;
}

function toHttpMetadata(context: AuditExecutionContext): HttpMetadata {
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

function mergeMetadata(
  existing: AuditableMetadata | undefined,
  http: HttpMetadata,
): AuditableMetadata {
  const safeExisting = existing && typeof existing === "object" ? existing : {};

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

export class AuditInterceptor implements Interceptor<AuditExecutionContext> {
  constructor(private readonly repository: AuditLogRepository) {}

  private async writeAuditLog(entry: Omit<AuditLogEntry, "id" | "createdAt">): Promise<void> {
    await this.repository.create(entry);
  }

  async intercept(context: AuditExecutionContext, next: CallHandler): Promise<unknown> {
    const target = context.getClass();
    const handler = context.getHandler();
    const http = toHttpMetadata(context);
    const existingMetadata = Reflect.getMetadata(AUDIT_METADATA_KEY, target, handler) as
      | AuditableMetadata
      | undefined;

    if (existingMetadata) {
      return next.handle();
    }

    const contextData = Context.get();
    const controllerName = target.name || "UnknownController";

    try {
      const result = await next.handle();

      await this.writeAuditLog({
        tenantId: contextData?.tenantId ?? "unknown",
        actorId: contextData?.user?.id ?? "unknown",
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
      await this.writeAuditLog({
        tenantId: contextData?.tenantId ?? "unknown",
        actorId: contextData?.user?.id ?? "unknown",
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
