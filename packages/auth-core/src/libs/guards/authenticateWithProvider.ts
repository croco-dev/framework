import { Problem } from "@croco/problems-core";
import type { AuthRequest } from "../interfaces/AuthRequest";
import { AuthProviderUnavailableProblem } from "../problems/AuthProblems";

export interface AuthenticatingProvider<TPrincipal> {
  authenticate(request: AuthRequest): Promise<TPrincipal | null> | TPrincipal | null;
}

function getErrorCause(error: unknown): Error | undefined {
  return error instanceof Error ? error : undefined;
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

    throw new AuthProviderUnavailableProblem(undefined, getErrorCause(error));
  }
}
