import { Problem, ProblemCategory } from "@croco/problems-core";
import type { AccessProvider } from "./interfaces/AccessProvider.js";
import {
  createPolicyDecisionTrace,
  recordPolicyDecisionTrace,
  type PolicyDecisionResult,
  type PolicyDecisionTraceSink,
} from "./PolicyDecisionTrace.js";
import type {
  CheckRequest,
  CheckResult,
  GrantRequest,
  ListRequest,
  RevokeRequest,
} from "./types.js";

export type AccessEngineOptions = {
  readonly traceSink?: PolicyDecisionTraceSink;
};

export class AccessEngine {
  constructor(
    private provider: AccessProvider,
    private readonly options: AccessEngineOptions = {},
  ) {}

  async check(request: CheckRequest): Promise<CheckResult> {
    try {
      const result = await this.provider.check(request);
      return await this.withTrace(
        request,
        result,
        result.allowed ? "allow" : (result.decision ?? "deny"),
      );
    } catch (error) {
      if (this.isBusinessProblem(error)) {
        return await this.withTrace(request, {
          allowed: false,
          decision: "abstain",
          reason: error.detail ?? error.message,
        });
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

  private async withTrace(
    request: CheckRequest,
    result: CheckResult,
    decision: PolicyDecisionResult = result.decision ?? (result.allowed ? "allow" : "deny"),
  ): Promise<CheckResult> {
    const trace = createPolicyDecisionTrace({
      policyKind: "access",
      result: decision,
      ruleId:
        request.ruleId ?? `access:${resourceTypeFromObject(request.object)}:${request.relation}`,
      subjectRef: request.subject,
      resourceRef: request.object,
      tenantId: request.tenantId,
      sourceLocation: request.sourceLocation,
      reason: result.reason,
      inputs: {
        tenantId: request.tenantId,
        subject: request.subject,
        relation: request.relation,
        object: request.object,
        ...request.inputs,
      },
    });
    await recordPolicyDecisionTrace(trace, { auditSink: this.options.traceSink });

    return {
      ...result,
      decision,
      trace,
    };
  }
}

function resourceTypeFromObject(object: CheckRequest["object"]): string {
  return object.split(":", 1)[0];
}
