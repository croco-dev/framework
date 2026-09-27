import { GoalDefinitionInvalidProblem } from "./GoalProblems";
import type { GoalDefinition } from "./types";

function requireText(value: unknown, field: string): asserts value is string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new GoalDefinitionInvalidProblem(field, "required");
  }
}

function requireSafeHref(value: string | undefined, field: string): void {
  if (value === undefined) return;
  requireText(value, field);
  if (value.startsWith("/") && !value.startsWith("//")) return;
  if (URL.canParse(value) && new URL(value).protocol === "https:") return;
  throw new GoalDefinitionInvalidProblem(field, "unsafe-link");
}

export function validateGoalDefinition(definition: GoalDefinition): GoalDefinition {
  if (!definition || typeof definition !== "object") {
    throw new GoalDefinitionInvalidProblem("definition", "required");
  }
  requireText(definition.id, "id");
  requireText(definition.version, "version");
  requireText(definition.actionId, "actionId");
  if (!["signup", "first_visit", "return"].includes(definition.anchor)) {
    throw new GoalDefinitionInvalidProblem("anchor", "unsupported");
  }
  if (!Number.isSafeInteger(definition.windowMs) || definition.windowMs <= 0) {
    throw new GoalDefinitionInvalidProblem("windowMs", "positive-safe-integer-required");
  }
  if (!Number.isSafeInteger(definition.allowedLatenessMs) || definition.allowedLatenessMs < 0) {
    throw new GoalDefinitionInvalidProblem(
      "allowedLatenessMs",
      "nonnegative-safe-integer-required",
    );
  }
  if (
    !Number.isSafeInteger(definition.windowMs + definition.allowedLatenessMs) ||
    definition.windowMs + definition.allowedLatenessMs <= 0
  ) {
    throw new GoalDefinitionInvalidProblem("allowedLatenessMs", "window-overflow");
  }
  if (!Number.isSafeInteger(definition.threshold) || definition.threshold <= 0) {
    throw new GoalDefinitionInvalidProblem("threshold", "positive-safe-integer-required");
  }
  if (!["events", "distinct_objects", "distinct_calendar_days"].includes(definition.countMode)) {
    throw new GoalDefinitionInvalidProblem("countMode", "unsupported");
  }
  if (!["retain", "retract"].includes(definition.deletedObjectPolicy)) {
    throw new GoalDefinitionInvalidProblem("deletedObjectPolicy", "unsupported");
  }
  requireText(definition.timezone, "timezone");
  try {
    new Intl.DateTimeFormat("en", { timeZone: definition.timezone });
  } catch {
    throw new GoalDefinitionInvalidProblem("timezone", "invalid-iana-timezone");
  }
  if (definition.title !== undefined) requireText(definition.title, "title");
  if (definition.description !== undefined) requireText(definition.description, "description");
  requireSafeHref(definition.nextActionHref, "nextActionHref");
  if (definition.guidanceSteps !== undefined && !Array.isArray(definition.guidanceSteps)) {
    throw new GoalDefinitionInvalidProblem("guidanceSteps", "array-required");
  }
  const stepIds = new Set<string>();
  for (const step of definition.guidanceSteps ?? []) {
    if (!step || typeof step !== "object") {
      throw new GoalDefinitionInvalidProblem("guidanceSteps", "invalid-step");
    }
    requireText(step.id, "guidanceSteps.id");
    requireText(step.title, "guidanceSteps.title");
    if (step.description !== undefined) requireText(step.description, "guidanceSteps.description");
    requireSafeHref(step.href, "guidanceSteps.href");
    if (stepIds.has(step.id)) {
      throw new GoalDefinitionInvalidProblem("guidanceSteps.id", "duplicate");
    }
    stepIds.add(step.id);
  }
  return structuredClone(definition);
}
