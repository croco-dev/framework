import { Component, Container, Inject } from "@croco/framework-context";
import { EntitlementOverageAllowedEvent, EntitlementQuotaExceededEvent } from "./events";
import {
  EntitlementEventPublisher,
  EntitlementMeterLookup,
  EntitlementQuotaChecker,
  PlanEntitlementRegistry,
  SubscriptionProvider,
} from "./interfaces";
import type { EntitlementCheckResult, EntitlementRule, OveragePolicy } from "./types";

@Component()
export class EntitlementManager {
  constructor(
    @Inject(PlanEntitlementRegistry.token) private readonly registry: PlanEntitlementRegistry,
    @Inject(SubscriptionProvider.token) private readonly subscriptionProvider: SubscriptionProvider,
    @Inject(EntitlementQuotaChecker.token) private readonly quotaChecker: EntitlementQuotaChecker,
    @Inject(EntitlementMeterLookup.token) private readonly meterLookup: EntitlementMeterLookup,
  ) {}

  async check(tenantId: string, featureKey: string): Promise<EntitlementCheckResult> {
    const planId = await this.subscriptionProvider.getCurrentPlanId(tenantId);
    if (!planId) {
      return { granted: false, featureKey, type: "boolean", reason: "no_subscription" };
    }

    const rule = await this.registry.findRule(planId, featureKey);
    if (!rule) {
      return { granted: false, featureKey, type: "boolean", reason: "not_entitled", planId };
    }

    switch (rule.type) {
      case "boolean":
        return {
          granted: true,
          featureKey,
          type: "boolean",
          planId,
        };

      case "static":
        return {
          granted: true,
          featureKey,
          type: "static",
          value: rule.value,
          planId,
        };

      case "metered":
        return this.checkMetered(tenantId, featureKey, rule, planId);
    }
  }

  private async checkMetered(
    tenantId: string,
    featureKey: string,
    rule: EntitlementRule,
    planId: string,
  ): Promise<EntitlementCheckResult> {
    const usageKey = rule.meterId ?? featureKey;
    const meterQuota = rule.meterId
      ? await this.meterLookup.getMeterQuota(tenantId, rule.meterId)
      : null;
    const quota = rule.quota ?? meterQuota;

    if (quota == null) {
      return {
        granted: false,
        featureKey,
        type: "metered",
        reason: "no_quota_defined",
        planId,
      };
    }

    const quotaStatus = await this.quotaChecker.checkQuota(tenantId, usageKey, quota);
    const overagePolicy = rule.overagePolicy ?? "BLOCK";

    if (!quotaStatus.exceeded) {
      return this.createMeteredResult({
        granted: true,
        featureKey,
        planId,
        quota,
        usage: quotaStatus.usage,
        remaining: quotaStatus.remaining,
        exceeded: false,
        overagePolicy,
      });
    }

    await this.publishEvent(
      new EntitlementQuotaExceededEvent(tenantId, featureKey, quotaStatus.usage, quota),
    );

    switch (overagePolicy) {
      case "BLOCK":
        return this.createMeteredResult({
          granted: false,
          featureKey,
          planId,
          quota,
          usage: quotaStatus.usage,
          remaining: quotaStatus.remaining,
          exceeded: true,
          reason: "quota_exceeded",
          overagePolicy,
        });

      case "WARN":
        return this.createMeteredResult({
          granted: true,
          featureKey,
          planId,
          quota,
          usage: quotaStatus.usage,
          remaining: quotaStatus.remaining,
          exceeded: true,
          overagePolicy,
        });

      case "ALLOW_WITH_OVERAGE":
        await this.publishEvent(
          new EntitlementOverageAllowedEvent(
            tenantId,
            featureKey,
            quotaStatus.usage,
            quota,
            planId,
          ),
        );

        return this.createMeteredResult({
          granted: true,
          featureKey,
          planId,
          quota,
          usage: quotaStatus.usage,
          remaining: quotaStatus.remaining,
          exceeded: true,
          overagePolicy,
        });
    }
  }

  private createMeteredResult(options: {
    granted: boolean;
    featureKey: string;
    planId: string;
    quota: number;
    usage: number;
    remaining: number;
    exceeded: boolean;
    overagePolicy: OveragePolicy;
    reason?: string;
  }): EntitlementCheckResult {
    return {
      granted: options.granted,
      featureKey: options.featureKey,
      type: "metered",
      quota: options.quota,
      usage: options.usage,
      remaining: options.remaining,
      exceeded: options.exceeded,
      planId: options.planId,
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
}
