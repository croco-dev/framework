import { RateLimitExceededProblem } from "../problems/RateLimitExceededProblem";
import { buildRateLimitHeaders } from "../RateLimitHeaders";
import type { RateLimiter } from "../RateLimiter";
import type { KeyContext } from "../RateLimitKeyBuilder";
import type { RateLimitPolicy } from "../types";

export const RATE_LIMIT_METADATA_KEY = Symbol("rateLimit");
export const ROUTE_GUARDS_METADATA_KEY = Symbol.for("croco:rest:guards");

export type RateLimitMetadata = {
  policy: RateLimitPolicy;
  customKey?: (context: unknown) => string;
};

type HttpResponseContext = {
  res: { headers: Record<string, string> };
};

export type GuardContext = KeyContext & {
  getRequest?(): unknown;
  getOptionalRequest?(): unknown;
  set<T>(key: string, value: T): void;
} & (
    | { getHandler(): (...args: unknown[]) => unknown }
    | {
        getClass(): { prototype: object };
        getHandler(): string | symbol;
      }
  );

export class RateLimitGuard {
  constructor(private readonly rateLimiter: RateLimiter) {}

  async canActivate(context: GuardContext): Promise<boolean> {
    const handler = context.getHandler();
    const target =
      typeof handler !== "function" && "getClass" in context
        ? Reflect.get(context.getClass().prototype, handler)
        : handler;
    const metadata = Reflect.getMetadata(RATE_LIMIT_METADATA_KEY, target) as
      | RateLimitMetadata
      | undefined;

    if (!metadata) {
      return true;
    }

    const result = metadata.customKey
      ? await this.rateLimiter.checkWithKey(metadata.customKey(context), metadata.policy)
      : await this.rateLimiter.check(this.keyContext(context), metadata.policy);

    context.set("rateLimitResult", result);

    if (!result.success) {
      const problem = new RateLimitExceededProblem(result);
      const httpContext = context as GuardContext & {
        getHttpContext?: () => HttpResponseContext | null;
      };
      if (typeof httpContext.getHttpContext === "function") {
        const response = httpContext.getHttpContext();
        if (response) {
          const headers = buildRateLimitHeaders(result, problem.retryAfterSeconds);
          context.set("rateLimitHeaders", headers);
          Object.assign(response.res.headers, headers);
        }
      }
      throw problem;
    }

    return true;
  }

  private keyContext(context: GuardContext): KeyContext {
    const request = context.getOptionalRequest
      ? context.getOptionalRequest()
      : context.getRequest?.();
    if (!isRecord(request)) return context;

    return {
      get: <T>(key: string): T | undefined => {
        if (key === "user") {
          const user = ownProperty(request, "user");
          if (isIdentified(user)) return user as T;

          const principal = ownProperty(request, "principal");
          if (isIdentified(principal) && principal.type === "user") return principal as T;
        }

        if (key === "apiKey") {
          const apiKey = ownProperty(request, "apiKey");
          const apiKeyValue = apiKeyId(apiKey);
          if (apiKeyValue !== undefined) return apiKeyValue as T;

          const principal = ownProperty(request, "principal");
          if (isRecord(principal) && principal.type === "apikey") {
            const principalValue = apiKeyId(principal);
            if (principalValue !== undefined) return principalValue as T;
          }
        }

        return context.get<T>(key);
      },
    };
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function ownProperty(record: Record<string, unknown>, key: string): unknown {
  return Object.prototype.hasOwnProperty.call(record, key) ? record[key] : undefined;
}

function isIdentified(value: unknown): value is Record<string, unknown> & { id: string } {
  return isRecord(value) && typeof value.id === "string";
}

function apiKeyId(value: unknown): string | undefined {
  if (!isIdentified(value)) return undefined;
  if (value.keyId === undefined) return value.id;
  return typeof value.keyId === "string" ? value.keyId : undefined;
}
