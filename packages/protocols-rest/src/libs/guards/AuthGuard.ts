import type { Guard } from "@croco/framework-context";
import { Problem, ProblemFactory } from "@croco/problems-core";
import type { ExecutionContext } from "../interfaces/ExecutionContext";
import type { HttpRequestLike } from "../types";

export type TokenVerifier = (token: string) => Promise<unknown> | unknown;

export type AuthGuardOptions = {
  verifier: TokenVerifier;
  headerName?: string;
  scheme?: string;
};

function invalidTokenProblem(): Problem {
  return ProblemFactory.unauthorized(
    "protocols-rest/auth-invalid-token",
    "Invalid or expired token",
  );
}

function isTokenVerificationError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const name = error.name.toUpperCase();
  const message = error.message.toLowerCase();

  return (
    name.startsWith("ERR_JWT_") ||
    name.startsWith("ERR_JWS_") ||
    name.startsWith("ERR_JWE_") ||
    message.includes("token expired") ||
    message.includes("invalid token") ||
    message.includes("jwt expired") ||
    message.includes("token invalid")
  );
}

/**
 * Authorization 헤더를 검증해 사용자 정보를 요청 객체에 주입하는 Guard입니다.
 */
export class AuthGuard implements Guard<ExecutionContext> {
  private readonly verifier: TokenVerifier;
  private readonly headerName: string;
  private readonly scheme: string;

  constructor(options: AuthGuardOptions) {
    this.verifier = options.verifier;
    this.headerName = options.headerName ?? "authorization";
    this.scheme = options.scheme ?? "Bearer";
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.getRequest();

    // 타입 가드로 HttpRequestLike 최소 속성 검증
    if (typeof request !== "object" || request === null || !("headers" in request)) {
      throw ProblemFactory.badRequest(
        "protocols-rest/auth-invalid-request",
        "Invalid request object",
      );
    }

    const typedRequest = request as HttpRequestLike & { user?: unknown };
    const authHeader = this.getHeaderValue(typedRequest.headers, this.headerName);

    if (!authHeader) {
      throw ProblemFactory.unauthorized(
        "protocols-rest/auth-missing-header",
        "Missing authorization header",
      );
    }

    const token = this.extractToken(authHeader);
    if (!token) {
      throw ProblemFactory.badRequest(
        "protocols-rest/auth-invalid-header-format",
        "Invalid authorization header format",
      );
    }

    try {
      const user = await this.verifier(token);

      if (!user) {
        throw invalidTokenProblem();
      }

      typedRequest.user = user;

      return true;
    } catch (error) {
      if (error instanceof Problem) {
        throw error;
      }

      if (isTokenVerificationError(error)) {
        throw invalidTokenProblem();
      }

      throw ProblemFactory.internalServerError(
        "protocols-rest/auth-verifier-unavailable",
        "Authentication verifier is unavailable",
      );
    }
  }

  private extractToken(header: string): string | null {
    const parts = header.split(" ");
    if (parts.length !== 2) {
      return null;
    }

    const [scheme, token] = parts;
    if (scheme.toLowerCase() !== this.scheme.toLowerCase()) {
      return null;
    }

    if (!token) {
      return null;
    }

    return token;
  }

  private getHeaderValue(headers: unknown, headerName: string): string | undefined {
    if (headers instanceof Headers) {
      return headers.get(headerName) ?? undefined;
    }

    if (typeof headers !== "object" || headers === null) {
      return undefined;
    }

    const headerRecord = headers as Record<string, unknown>;
    const direct = headerRecord[headerName];

    if (typeof direct === "string") {
      return direct;
    }

    const normalizedHeaderName = headerName.toLowerCase();

    for (const [key, value] of Object.entries(headerRecord)) {
      if (key.toLowerCase() === normalizedHeaderName && typeof value === "string") {
        return value;
      }
    }

    return undefined;
  }
}
