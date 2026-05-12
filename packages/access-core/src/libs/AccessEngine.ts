import { Problem, ProblemCategory } from "@croco/problems-core";
import type { AccessProvider } from "./interfaces/AccessProvider.js";
import type {
  CheckRequest,
  CheckResult,
  GrantRequest,
  ListRequest,
  RevokeRequest,
} from "./types.js";

export class AccessEngine {
  constructor(private provider: AccessProvider) {}

  async check(request: CheckRequest): Promise<CheckResult> {
    try {
      return await this.provider.check(request);
    } catch (error) {
      if (this.isBusinessProblem(error)) {
        return { allowed: false };
      }

      throw error;
    }
  }

  private isBusinessProblem(error: unknown): error is Problem {
    return error instanceof Problem && error.category === ProblemCategory.BusinessRuleViolation;
  }

  async grant(request: GrantRequest): Promise<void> {
    return this.provider.grant(request);
  }

  async revoke(request: RevokeRequest): Promise<void> {
    return this.provider.revoke(request);
  }

  async list(request: ListRequest): Promise<ReturnType<AccessProvider["list"]>> {
    return this.provider.list(request);
  }
}
