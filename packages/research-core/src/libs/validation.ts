import { SurveyInvalidProblem } from "./SurveyProblems";
import type { SurveyAnswers, SurveyDefinition, SurveyScope } from "./types";

export function requireSurveyText(
  value: unknown,
  field: string,
  max = 256,
): asserts value is string {
  if (typeof value !== "string" || !value.trim() || value.length > max)
    throw new SurveyInvalidProblem(field);
}
export function validateSurveyScope(scope: SurveyScope): void {
  if (!scope || typeof scope !== "object") throw new SurveyInvalidProblem("scope");
  for (const field of ["tenantId", "appId", "environmentId"] as const)
    requireSurveyText(scope[field], field);
}
export function validateSurveyDefinition(d: SurveyDefinition): void {
  if (!d || typeof d !== "object") throw new SurveyInvalidProblem("definition");
  for (const field of ["id", "version", "title", "eligibility", "trigger"] as const)
    requireSurveyText(d[field], field);
  if (
    !Number.isFinite(Date.parse(d.startsAt)) ||
    !Number.isFinite(Date.parse(d.endsAt)) ||
    Date.parse(d.endsAt) <= Date.parse(d.startsAt)
  )
    throw new SurveyInvalidProblem("period");
  if (
    typeof d.allowEdits !== "boolean" ||
    !Number.isSafeInteger(d.retentionMs) ||
    d.retentionMs < 1 ||
    d.retentionMs > 365 * 86400000
  )
    throw new SurveyInvalidProblem("retention/edit policy");
  if (
    !d.frequencyPolicy ||
    !Number.isSafeInteger(d.frequencyPolicy.maxInvitations) ||
    d.frequencyPolicy.maxInvitations < 1 ||
    d.frequencyPolicy.maxInvitations > 100 ||
    !Number.isSafeInteger(d.frequencyPolicy.windowMs) ||
    d.frequencyPolicy.windowMs < 1 ||
    d.frequencyPolicy.windowMs > 365 * 86400000
  )
    throw new SurveyInvalidProblem("frequency policy");
  if (!Array.isArray(d.questions) || d.questions.length < 1 || d.questions.length > 20)
    throw new SurveyInvalidProblem("questions");
  const ids = new Set<string>();
  for (const q of d.questions) {
    if (!q || typeof q !== "object") throw new SurveyInvalidProblem("question");
    requireSurveyText(q.id, "question id");
    requireSurveyText(q.title, "question title", 1000);
    if (
      ids.has(q.id) ||
      ["__proto__", "constructor", "prototype"].includes(q.id) ||
      typeof q.required !== "boolean"
    )
      throw new SurveyInvalidProblem("question identity");
    ids.add(q.id);
    switch (q.kind) {
      case "single":
      case "multi": {
        if (!Array.isArray(q.options) || q.options.length < 2 || q.options.length > 30)
          throw new SurveyInvalidProblem("options");
        const choices = new Set<string>();
        for (const o of q.options) {
          requireSurveyText(o?.id, "option id");
          requireSurveyText(o?.label, "option label", 1000);
          if (choices.has(o.id)) throw new SurveyInvalidProblem("duplicate option");
          choices.add(o.id);
        }
        break;
      }
      case "scale":
        if (
          !Number.isSafeInteger(q.min) ||
          !Number.isSafeInteger(q.max) ||
          q.min >= q.max ||
          q.max - q.min > 20
        )
          throw new SurveyInvalidProblem("scale");
        break;
      case "text":
        if (!Number.isSafeInteger(q.maxLength) || q.maxLength < 1 || q.maxLength > 2000)
          throw new SurveyInvalidProblem("text length");
        break;
      default:
        throw new SurveyInvalidProblem("question kind");
    }
  }
}
/** Used unchanged by server submission and the preview renderer. */
export function validateSurveyAnswers(d: SurveyDefinition, answers: SurveyAnswers): void {
  validateSurveyDefinition(d);
  if (!answers || typeof answers !== "object" || Array.isArray(answers))
    throw new SurveyInvalidProblem("answers");
  const keys = Object.keys(answers);
  if (keys.some((key) => !d.questions.some((q) => q.id === key)))
    throw new SurveyInvalidProblem("unknown question");
  for (const q of d.questions) {
    const value = Object.hasOwn(answers, q.id) ? answers[q.id] : undefined;
    if (value === undefined) {
      if (q.required) throw new SurveyInvalidProblem(`required: ${q.id}`);
      continue;
    }
    switch (q.kind) {
      case "single":
        if (typeof value !== "string" || !q.options.some((o) => o.id === value))
          throw new SurveyInvalidProblem(`choice: ${q.id}`);
        break;
      case "multi":
        if (
          !Array.isArray(value) ||
          new Set(value).size !== value.length ||
          value.some((v) => typeof v !== "string" || !q.options.some((o) => o.id === v))
        )
          throw new SurveyInvalidProblem(`choices: ${q.id}`);
        if (q.required && value.length === 0) throw new SurveyInvalidProblem(`required: ${q.id}`);
        break;
      case "scale":
        if (
          typeof value !== "number" ||
          !Number.isSafeInteger(value) ||
          value < q.min ||
          value > q.max
        )
          throw new SurveyInvalidProblem(`scale: ${q.id}`);
        break;
      case "text":
        if (typeof value !== "string" || value.length > q.maxLength)
          throw new SurveyInvalidProblem(`text: ${q.id}`);
        if (q.required && value.length === 0) throw new SurveyInvalidProblem(`required: ${q.id}`);
        break;
    }
  }
}
export function surveyCsvCell(value: string): string {
  const safe =
    /^[=+@-]/u.test(value.replace(/^[\s\p{Cc}]*/u, "")) || /^[\t\r\n]/u.test(value)
      ? `'${value}`
      : value;
  return `"${safe.replaceAll('"', '""')}"`;
}
