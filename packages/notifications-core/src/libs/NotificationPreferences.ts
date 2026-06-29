import { NotificationChannel } from "./types";

export type NotificationPreferenceContext = {
  readonly tenantId: string;
  readonly userId: string;
  readonly channel: NotificationChannel;
  readonly topic: string;
};

export type NotificationPreferenceRule = {
  readonly id: string;
  readonly enabled: boolean;
  readonly tenantId?: string;
  readonly userId?: string;
  readonly channel?: NotificationChannel;
  readonly topic?: string;
  readonly reason?: string;
};

export type NotificationPreferenceDecision = {
  readonly allowed: boolean;
  readonly context: NotificationPreferenceContext;
  readonly reason: string;
  readonly ruleId?: string;
  readonly evaluationKey: string;
};

export type NotificationPreferenceEvaluatorOptions = {
  readonly defaultAllowed?: boolean;
  readonly rules?: readonly NotificationPreferenceRule[];
};

export class NotificationPreferenceEvaluator {
  private rules: NotificationPreferenceRule[] = [];
  private readonly defaultAllowed: boolean;

  constructor(options: NotificationPreferenceEvaluatorOptions = {}) {
    this.defaultAllowed = options.defaultAllowed ?? true;
    this.rules = sortPreferenceRules(options.rules ?? []);
  }

  registerRule(rule: NotificationPreferenceRule): void {
    this.rules = sortPreferenceRules([...this.rules, rule]);
  }

  evaluate(context: NotificationPreferenceContext): NotificationPreferenceDecision {
    const rule = this.rules.find((candidate) => matchesPreferenceRule(candidate, context));
    const evaluationKey = createNotificationPreferenceEvaluationKey(context);

    if (rule === undefined) {
      return {
        allowed: this.defaultAllowed,
        context,
        reason: this.defaultAllowed ? "default-allow" : "default-deny",
        evaluationKey,
      };
    }

    return {
      allowed: rule.enabled,
      context,
      reason: rule.reason ?? (rule.enabled ? "preference-allow" : "preference-deny"),
      ruleId: rule.id,
      evaluationKey,
    };
  }
}

export function createNotificationPreferenceEvaluationKey(
  context: NotificationPreferenceContext,
): string {
  return [
    "notification-preference",
    context.tenantId,
    context.userId,
    context.channel,
    context.topic,
  ]
    .map(encodeURIComponent)
    .join(":");
}

export function createNotificationPreferenceContextFixture(
  overrides: Partial<NotificationPreferenceContext> = {},
): NotificationPreferenceContext {
  return {
    tenantId: "fixture-tenant",
    userId: "fixture-user",
    channel: NotificationChannel.EMAIL,
    topic: "fixture.topic",
    ...overrides,
  };
}

function sortPreferenceRules(
  rules: readonly NotificationPreferenceRule[],
): NotificationPreferenceRule[] {
  return [...rules].sort((left, right) => {
    const specificity = getPreferenceRuleSpecificity(right) - getPreferenceRuleSpecificity(left);

    if (specificity !== 0) {
      return specificity;
    }

    return left.id.localeCompare(right.id);
  });
}

function getPreferenceRuleSpecificity(rule: NotificationPreferenceRule): number {
  return (
    (rule.userId === undefined ? 0 : 8) +
    (rule.tenantId === undefined ? 0 : 4) +
    (rule.channel === undefined ? 0 : 2) +
    (rule.topic === undefined ? 0 : 1)
  );
}

function matchesPreferenceRule(
  rule: NotificationPreferenceRule,
  context: NotificationPreferenceContext,
): boolean {
  return (
    matchesPreferenceDimension(rule.tenantId, context.tenantId) &&
    matchesPreferenceDimension(rule.userId, context.userId) &&
    matchesPreferenceDimension(rule.channel, context.channel) &&
    matchesPreferenceDimension(rule.topic, context.topic)
  );
}

function matchesPreferenceDimension<TValue>(expected: TValue | undefined, actual: TValue): boolean {
  return expected === undefined || expected === actual;
}
