import {
  DuplicateLifecycleRuleProblem,
  LifecycleRuleDefinitionProblem,
} from "./problems/LifecycleProblems";
import type { LifecycleRule, LifecycleSignal } from "./types";

function validateRule(rule: LifecycleRule): void {
  if (rule.id.trim().length === 0) {
    throw new LifecycleRuleDefinitionProblem(rule.id, "id must not be empty");
  }

  if (rule.description.trim().length === 0) {
    throw new LifecycleRuleDefinitionProblem(rule.id, "description must not be empty");
  }

  if (rule.triggers.length === 0) {
    throw new LifecycleRuleDefinitionProblem(rule.id, "at least one trigger is required");
  }

  if (Array.isArray(rule.actions) && rule.actions.length === 0) {
    throw new LifecycleRuleDefinitionProblem(rule.id, "at least one action is required");
  }

  if (rule.cooldown && rule.cooldown.durationMs <= 0) {
    throw new LifecycleRuleDefinitionProblem(rule.id, "cooldown duration must be positive");
  }
}

function signalMatches(rule: LifecycleRule, signal: LifecycleSignal): boolean {
  return rule.triggers.some((trigger) => trigger.type === "*" || trigger.type === signal.type);
}

export class LifecycleRuleRegistry {
  private readonly rules = new Map<string, LifecycleRule>();

  register(rule: LifecycleRule): void {
    validateRule(rule);

    if (this.rules.has(rule.id)) {
      throw new DuplicateLifecycleRuleProblem(rule.id);
    }

    this.rules.set(rule.id, rule);
  }

  get(ruleId: string): LifecycleRule | undefined {
    return this.rules.get(ruleId);
  }

  getAll(): readonly LifecycleRule[] {
    return Array.from(this.rules.values());
  }

  match(signal: LifecycleSignal): readonly LifecycleRule[] {
    return this.getAll().filter((rule) => signalMatches(rule, signal));
  }
}
