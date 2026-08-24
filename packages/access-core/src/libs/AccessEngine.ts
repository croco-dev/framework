import { Problem, ProblemCategory, ProblemFactory } from "@croco/problems-core";
import type { AccessProvider } from "./interfaces/AccessProvider.js";
import {
  createPolicyDecisionTrace,
  recordPolicyDecisionTrace,
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
      const result = normalizeCheckResult(await this.provider.check(request));
      return await this.withTrace(request, result);
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

  private async withTrace(request: CheckRequest, result: CheckResult): Promise<CheckResult> {
    const trace = createPolicyDecisionTrace({
      policyKind: "access",
      result: result.decision,
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
      trace,
    };
  }
}

function normalizeCheckResult(result: unknown): CheckResult {
  if (result === null || typeof result !== "object") {
    throw invalidProviderResultProblem();
  }

  const decision = (result as { readonly decision?: unknown }).decision;

  switch (decision) {
    case "allow":
      return { ...(result as CheckResult), decision, allowed: true };
    case "deny":
      return { ...(result as CheckResult), decision, allowed: false };
    case "abstain":
      return { ...(result as CheckResult), decision, allowed: false };
    default:
      throw invalidProviderResultProblem();
  }
}

function invalidProviderResultProblem(): Problem {
  return ProblemFactory.internalServerError(
    "access-core/invalid-provider-result",
    "AccessProvider.check() returned a result without a supported decision.",
  );
}

function resourceTypeFromObject(object: CheckRequest["object"]): string {
  return object.split(":", 1)[0];
}
