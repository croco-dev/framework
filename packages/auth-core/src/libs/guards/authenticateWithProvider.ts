import { Problem } from "@croco/problems-core";
import type { AuthRequest } from "../interfaces/AuthRequest";
import { AuthProviderUnavailableProblem } from "../problems/AuthProblems";

export interface AuthenticatingProvider<TPrincipal> {
  authenticate(request: AuthRequest): Promise<TPrincipal | null> | TPrincipal | null;
}

function stringifyThrownValue(error: unknown): string {
  if (typeof error === "string") {
    return error;
  }

  if (error === null) {
    return "null";
  }

  if (error === undefined) {
    return "undefined";
  }

  if (typeof error !== "object") {
    return String(error);
  }

  try {
    return JSON.stringify(error) ?? Object.prototype.toString.call(error);
  } catch {
    return Object.prototype.toString.call(error);
  }
}

function toErrorCause(error: unknown): Error {
  if (error instanceof Error) {
    return error;
  }

  const cause = new Error(`Auth provider threw a non-Error value: ${stringifyThrownValue(error)}`);
  Object.defineProperty(cause, "cause", {
    configurable: true,
    enumerable: false,
    value: error,
    writable: true,
  });
  return cause;
}

export async function authenticateWithProvider<TPrincipal>(
  provider: AuthenticatingProvider<TPrincipal>,
  request: AuthRequest,
): Promise<TPrincipal | null> {
  try {
    return await provider.authenticate(request);
  } catch (error) {
    if (error instanceof Problem) {
      throw error;
    }

    throw new AuthProviderUnavailableProblem(undefined, toErrorCause(error));
  }
}
