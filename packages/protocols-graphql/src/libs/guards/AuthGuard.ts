import type { Guard } from "@croco/framework-context";
import { Problem, ProblemCategory } from "@croco/problems-core";
import type { GraphQLGuardContext } from "../types/GuardTypes";

export type TokenVerifier = (token: string) => Promise<unknown> | unknown;

export type AuthGuardOptions = {
  verifier: TokenVerifier;
  headerName?: string;
  scheme?: string;
};

class GraphQLAuthGuardProblem extends Problem {
  constructor(status: number, code: string, detail: string) {
    const category =
      status === 400
        ? ProblemCategory.BadRequest
        : status === 500
          ? ProblemCategory.InternalServerError
          : ProblemCategory.Unauthorized;

    super(code, category, detail);
  }
}

function unauthorized(code: string, detail: string): GraphQLAuthGuardProblem {
  return new GraphQLAuthGuardProblem(401, code, detail);
}

function badRequest(code: string, detail: string): GraphQLAuthGuardProblem {
  return new GraphQLAuthGuardProblem(400, code, detail);
}

function verifierUnavailable(detail: string): GraphQLAuthGuardProblem {
  return new GraphQLAuthGuardProblem(500, "AUTH_VERIFIER_UNAVAILABLE", detail);
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

export class GraphQLAuthGuard implements Guard<GraphQLGuardContext> {
  private readonly verifier: TokenVerifier;
  private readonly headerName: string;
  private readonly scheme: string;

  constructor(options: AuthGuardOptions) {
    this.verifier = options.verifier;
    this.headerName = options.headerName ?? "authorization";
    this.scheme = options.scheme ?? "Bearer";
  }

  async canActivate(context: GraphQLGuardContext): Promise<boolean> {
    const headers = (context.context as { headers?: Record<string, string> }).headers;

    if (!headers) {
      throw badRequest("AUTH_INVALID_REQUEST", "Invalid request context");
    }

    const authHeader = this.getHeaderValue(headers, this.headerName);

    if (!authHeader) {
      throw unauthorized("AUTH_MISSING_HEADER", "Missing authorization header");
    }

    const token = this.extractToken(authHeader);
    if (!token) {
      throw badRequest("AUTH_INVALID_HEADER_FORMAT", "Invalid authorization header format");
    }

    try {
      const user = await this.verifier(token);

      if (!user) {
        throw unauthorized("AUTH_INVALID_TOKEN", "Invalid or expired token");
      }

      const ctx = context.context as { user?: unknown };
      ctx.user = user;

      return true;
    } catch (error) {
      if (error instanceof Problem && error.code === "AUTH_INVALID_TOKEN") {
        throw error;
      }

      if (isTokenVerificationError(error)) {
        throw unauthorized("AUTH_INVALID_TOKEN", "Invalid or expired token");
      }

      throw verifierUnavailable("Authentication verifier is unavailable");
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

  private getHeaderValue(headers: Record<string, string>, headerName: string): string | undefined {
    const direct = headers[headerName];

    if (typeof direct === "string") {
      return direct;
    }

    const normalizedHeaderName = headerName.toLowerCase();

    for (const [key, value] of Object.entries(headers)) {
      if (key.toLowerCase() === normalizedHeaderName) {
        return value;
      }
    }

    return undefined;
  }
}
