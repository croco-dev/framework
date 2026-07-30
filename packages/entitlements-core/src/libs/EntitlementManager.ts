import {
  createPolicyDecisionTrace,
  recordPolicyDecisionTrace,
  type PolicyDecisionResult,
  type PolicyDecisionTraceSink,
} from "@croco/access-core";
import { Component, Container, Inject } from "@croco/framework-context";
import type { PlanVersionRef } from "@croco/billing-core";
import { featureKey, getLegacyPlanId, legacyPlanVersionRef } from "./EntitlementDefinition";
import type { FeatureReference } from "./EntitlementDefinition";
import { EntitlementOverageAllowedEvent, EntitlementQuotaExceededEvent } from "./events";
import {
  EntitlementEventPublisher,
  EntitlementMeterLookup,
  EntitlementQuotaChecker,
  PlanEntitlementRegistry,
  SubscriptionProvider,
} from "./interfaces";
import { EntitlementDefinitionProblem } from "./problems/EntitlementProblems";
import type {
  EntitlementCheckOptions,
  EntitlementCheckResult,
  EntitlementRule,
  OveragePolicy,
} from "./types";

export type EntitlementManagerOptions = {
  readonly traceSink?: PolicyDecisionTraceSink;
};

@Component()
export class EntitlementManager {
  constructor(
    @Inject(PlanEntitlementRegistry.token) private readonly registry: PlanEntitlementRegistry,
    @Inject(SubscriptionProvider.token) private readonly subscriptionProvider: SubscriptionProvider,
    @Inject(EntitlementQuotaChecker.token) private readonly quotaChecker: EntitlementQuotaChecker,
    @Inject(EntitlementMeterLookup.token) private readonly meterLookup: EntitlementMeterLookup,
    private readonly options: EntitlementManagerOptions = {},
  ) {}

  async check(
    tenantId: string,
    feature: FeatureReference,
    checkOptions: EntitlementCheckOptions = {},
  ): Promise<EntitlementCheckResult> {
    const normalizedFeatureKey = featureKey(feature);
    const plan = this.subscriptionProvider.getCurrentPlanVersion
      ? await this.subscriptionProvider.getCurrentPlanVersion(tenantId)
      : await this.getLegacySubscriptionPlan(tenantId);
    if (!plan) {
      return this.withTrace(
        tenantId,
        {
          granted: false,
          status: "denied",
          featureKey: normalizedFeatureKey,
          type: "boolean",
          reason: "no_subscription",
        },
        checkOptions,
      );
    }

    const rule = await this.registry.findRuleByPlanVersion(
      plan.planVersionRef,
      normalizedFeatureKey,
      plan.planId,
    );
    if (!rule) {
      return this.withTrace(
        tenantId,
        {
          granted: false,
          status: "denied",
          featureKey: normalizedFeatureKey,
          type: "boolean",
          reason: "not_entitled",
          planId: plan.planId,
          planVersionRef: plan.planVersionRef,
        },
        checkOptions,
      );
    }

    switch (rule.type) {
      case "boolean":
        return this.withTrace(
          tenantId,
          {
            granted: true,
            status: "allowed",
            featureKey: normalizedFeatureKey,
            type: "boolean",
            planId: plan.planId,
            planVersionRef: plan.planVersionRef,
          },
          checkOptions,
        );

      case "static":
        return this.withTrace(
          tenantId,
          {
            granted: true,
            status: "allowed",
            featureKey: normalizedFeatureKey,
            type: "static",
            value: rule.value,
            planId: plan.planId,
            planVersionRef: plan.planVersionRef,
          },
          checkOptions,
        );

      case "metered":
        return this.checkMetered(
          tenantId,
          normalizedFeatureKey,
          rule,
          plan.planId,
          plan.planVersionRef,
          checkOptions,
        );
    }
  }

  private async getLegacySubscriptionPlan(
    tenantId: string,
  ): Promise<{ planId: string; planVersionRef: PlanVersionRef } | null> {
    const planId = await this.subscriptionProvider.getCurrentPlanId(tenantId);
    return planId === null
      ? null
      : {
          planId,
          planVersionRef: legacyPlanVersionRef(planId),
        };
  }

  private async checkMetered(
    tenantId: string,
    featureKey: string,
    rule: EntitlementRule,
    planId: string,
    planVersionRef: PlanVersionRef,
    checkOptions: EntitlementCheckOptions,
  ): Promise<EntitlementCheckResult> {
    if (getLegacyPlanId(planVersionRef) === null && rule.quota === undefined) {
      throw new EntitlementDefinitionProblem(
        `Version-bound metered entitlement '${featureKey}' requires an inline quota.`,
      );
    }

    const usageKey = rule.meterId ?? featureKey;
    const meterQuota = rule.meterId
      ? await this.meterLookup.getMeterQuota(tenantId, rule.meterId)
      : null;
    const quota = rule.quota ?? meterQuota;

    if (quota == null) {
      return this.withTrace(
        tenantId,
        {
          granted: false,
          status: "denied",
          featureKey,
          type: "metered",
          reason: "no_quota_defined",
          planId,
          planVersionRef,
        },
        checkOptions,
        {
          meterId: rule.meterId,
          quotaSource: "missing",
        },
      );
    }

    const quotaStatus = await this.quotaChecker.checkQuota(tenantId, usageKey, quota);
    const overagePolicy = rule.overagePolicy ?? "BLOCK";

    if (!quotaStatus.exceeded) {
      return this.withTrace(
        tenantId,
        this.createMeteredResult({
          granted: true,
          status: "allowed",
          featureKey,
          planId,
          planVersionRef,
          quota,
          usage: quotaStatus.usage,
          remaining: quotaStatus.remaining,
          exceeded: false,
          overagePolicy,
        }),
        checkOptions,
      );
    }

    await this.publishEvent(
      new EntitlementQuotaExceededEvent(tenantId, featureKey, quotaStatus.usage, quota),
    );

    switch (overagePolicy) {
      case "BLOCK":
        return this.withTrace(
          tenantId,
          this.createMeteredResult({
            granted: false,
            status: "denied",
            featureKey,
            planId,
            planVersionRef,
            quota,
            usage: quotaStatus.usage,
            remaining: quotaStatus.remaining,
            exceeded: true,
            reason: "quota_exceeded",
            overagePolicy,
          }),
          checkOptions,
        );

      case "WARN":
        return this.withTrace(
          tenantId,
          this.createMeteredResult({
            granted: true,
            status: "soft-limit",
            featureKey,
            planId,
            planVersionRef,
            quota,
            usage: quotaStatus.usage,
            remaining: quotaStatus.remaining,
            exceeded: true,
            overagePolicy,
          }),
          checkOptions,
        );

      case "ALLOW_WITH_OVERAGE":
        await this.publishEvent(
          new EntitlementOverageAllowedEvent(
            tenantId,
            featureKey,
            quotaStatus.usage,
            quota,
            planId,
            planVersionRef,
          ),
        );

        return this.withTrace(
          tenantId,
          this.createMeteredResult({
            granted: true,
            status: "overage-allowed",
            featureKey,
            planId,
            planVersionRef,
            quota,
            usage: quotaStatus.usage,
            remaining: quotaStatus.remaining,
            exceeded: true,
            overagePolicy,
          }),
          checkOptions,
        );
    }
  }

  private createMeteredResult(options: {
    granted: boolean;
    status: EntitlementCheckResult["status"];
    featureKey: string;
    planId: string;
    planVersionRef: PlanVersionRef;
    quota: number;
    usage: number;
    remaining: number;
    exceeded: boolean;
    overagePolicy: OveragePolicy;
    reason?: EntitlementCheckResult["reason"];
  }): EntitlementCheckResult {
    return {
      granted: options.granted,
      status: options.status,
      featureKey: options.featureKey,
      type: "metered",
      quota: options.quota,
      usage: options.usage,
      remaining: options.remaining,
      exceeded: options.exceeded,
      planId: options.planId,
      planVersionRef: options.planVersionRef,
      reason: options.reason,
      overagePolicy: options.overagePolicy,
    };
  }

  private async publishEvent(
    event: EntitlementQuotaExceededEvent | EntitlementOverageAllowedEvent,
  ): Promise<void> {
    const publisher = Container.getOptional(EntitlementEventPublisher.token);
    if (!publisher) {
      return;
    }

    await publisher.publish(event);
  }

  private async withTrace(
    tenantId: string,
    result: EntitlementCheckResult,
    checkOptions: EntitlementCheckOptions,
    extraInputs: Record<string, unknown> = {},
  ): Promise<EntitlementCheckResult> {
    const decision: PolicyDecisionResult = result.granted ? "allow" : "deny";
    const trace = createPolicyDecisionTrace({
      policyKind: "entitlement",
      result: decision,
      ruleId: checkOptions.ruleId ?? `entitlement:${result.featureKey}`,
      subjectRef: checkOptions.subjectRef,
      resourceRef: `entitlement:${result.featureKey}`,
      tenantId,
      sourceLocation: checkOptions.sourceLocation,
      reason: result.reason,
      inputs: {
        tenantId,
        featureKey: result.featureKey,
        type: result.type,
        planId: result.planId,
        planVersionRef: result.planVersionRef,
        usage: result.usage,
        quota: result.quota,
        remaining: result.remaining,
        exceeded: result.exceeded,
        overagePolicy: result.overagePolicy,
        ...extraInputs,
        ...checkOptions.inputs,
      },
    });
    await recordPolicyDecisionTrace(trace, { auditSink: this.options.traceSink });

    return {
      ...result,
      trace,
    };
  }
}
