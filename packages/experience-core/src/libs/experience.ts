import { Problem, ProblemCategory } from "@croco/problems-core";
import type { PublishedCohortReader } from "@croco/cohort-core";
import type {
  ExperienceConfig,
  ExperienceContext,
  ExperienceContextPredicate,
  ExperienceDecision,
  ExperienceReceiptInput,
  ExperienceScalar,
  ExperienceScope,
  ExperienceSourceSnapshotRef,
  ExperienceStore,
  ExperienceSubject,
  ExposureHandle,
  PlacementDefinition,
  StoredExperienceDecision,
} from "./contracts";

export class ExperienceInvalidProblem extends Problem {
  constructor(detail: string) {
    super("experience/invalid", ProblemCategory.ValidationError, detail);
  }
}
export class ExperienceUnavailableProblem extends Problem {
  constructor(detail: string) {
    super("experience/unavailable", ProblemCategory.ValidationError, detail);
  }
}

function exactKeys(
  value: unknown,
  allowed: readonly string[],
  label: string,
): asserts value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new ExperienceInvalidProblem(`${label} must be an object`);
  if (Object.keys(value).some((key) => !allowed.includes(key)))
    throw new ExperienceInvalidProblem(`${label} contains an unknown field`);
}
function text(value: unknown, label: string): asserts value is string {
  if (typeof value !== "string" || !value.trim())
    throw new ExperienceInvalidProblem(`${label} is required`);
}
function validateLocale(locale: string | undefined): void {
  if (locale !== undefined && !/^[a-z]{2,3}(?:-[A-Z]{2})?$/.test(locale))
    throw new ExperienceInvalidProblem("Locale is invalid");
}
function scopeValid(scope: ExperienceScope): boolean {
  return Boolean(scope && scope.appId && scope.environment && scope.tenantId);
}
function safeActionUrl(value: string): boolean {
  if (/\s|\\/.test(value)) return false;
  if (/^\/(?!\/)/.test(value)) return true;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && Boolean(url.hostname) && !url.username && !url.password;
  } catch {
    return false;
  }
}
export function sameExperienceScope(a: ExperienceScope, b: ExperienceScope): boolean {
  return (
    scopeValid(a) &&
    a.appId === b.appId &&
    a.environment === b.environment &&
    a.tenantId === b.tenantId
  );
}
function timestamp(value: string): number {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed) || !/T.*(?:Z|[+-]\d{2}:\d{2})$/.test(value))
    throw new ExperienceInvalidProblem("An explicit timestamp with timezone is required");
  return parsed;
}
function scalarType(value: unknown): "string" | "number" | "boolean" | undefined {
  if (typeof value === "string") return "string";
  if (typeof value === "boolean") return "boolean";
  if (typeof value === "number" && Number.isFinite(value)) return "number";
  return undefined;
}
export function definePlacement(input: PlacementDefinition): PlacementDefinition {
  exactKeys(input, ["id", "schema", "allowedRenderers"], "Placement");
  text(input.id, "Placement id");
  exactKeys(input.schema, ["contextFields", "content"], "Placement schema");
  exactKeys(
    input.schema.contextFields,
    Object.keys(input.schema.contextFields ?? {}),
    "Context fields",
  );
  if (
    Object.entries(input.schema.contextFields).some(
      ([name, type]) => !name || !["string", "number", "boolean"].includes(type),
    )
  )
    throw new ExperienceInvalidProblem("Context fields are invalid");
  const content = input.schema.content;
  exactKeys(
    content,
    ["locales", "maxTitleLength", "maxBodyLength", "allowActionUrl"],
    "Content schema",
  );
  if (
    !Array.isArray(content.locales) ||
    content.locales.length === 0 ||
    content.locales.some(
      (locale) => typeof locale !== "string" || !/^[a-z]{2,3}(?:-[A-Z]{2})?$/.test(locale),
    ) ||
    new Set(content.locales).size !== content.locales.length ||
    !Number.isSafeInteger(content.maxTitleLength) ||
    content.maxTitleLength < 1 ||
    !Number.isSafeInteger(content.maxBodyLength) ||
    content.maxBodyLength < 1 ||
    typeof content.allowActionUrl !== "boolean"
  )
    throw new ExperienceInvalidProblem("Content schema is invalid");
  if (
    !Array.isArray(input.allowedRenderers) ||
    input.allowedRenderers.length === 0 ||
    input.allowedRenderers.some((renderer) => typeof renderer !== "string" || !renderer) ||
    new Set(input.allowedRenderers).size !== input.allowedRenderers.length
  )
    throw new ExperienceInvalidProblem("Allowed renderers are invalid");
  return Object.freeze({
    id: input.id,
    schema: Object.freeze({
      contextFields: Object.freeze({ ...input.schema.contextFields }),
      content: Object.freeze({ ...content, locales: Object.freeze([...content.locales]) }),
    }),
    allowedRenderers: Object.freeze([...input.allowedRenderers]),
  });
}
function validatePredicate(
  predicate: ExperienceContextPredicate,
  placement: PlacementDefinition,
): void {
  exactKeys(predicate, ["field", "operator", "value"], "Context predicate");
  text(predicate.field, "Context field");
  const fieldType = placement.schema.contextFields[predicate.field];
  if (!fieldType || !["eq", "in"].includes(predicate.operator))
    throw new ExperienceInvalidProblem("Context predicate is not allowed");
  const values = predicate.operator === "in" ? predicate.value : [predicate.value];
  if (
    !Array.isArray(values) ||
    values.length === 0 ||
    values.length > 50 ||
    values.some((value) => scalarType(value) !== fieldType)
  )
    throw new ExperienceInvalidProblem("Context predicate value is invalid");
}
export function validateExperienceConfig(
  config: ExperienceConfig,
  placement: PlacementDefinition,
  scope: ExperienceScope,
): void {
  exactKeys(
    config,
    [
      "id",
      "placementId",
      "scope",
      "revision",
      "status",
      "renderer",
      "content",
      "targeting",
      "priority",
      "startAt",
      "endAt",
      "frequency",
    ],
    "Experience config",
  );
  text(config.id, "Config id");
  exactKeys(config.scope, ["appId", "environment", "tenantId"], "Scope");
  if (config.placementId !== placement.id || !sameExperienceScope(config.scope, scope))
    throw new ExperienceInvalidProblem("Placement or scope mismatch");
  if (
    !Number.isSafeInteger(config.revision) ||
    config.revision < 1 ||
    !["draft", "published", "paused", "archived"].includes(config.status) ||
    !Number.isSafeInteger(config.priority) ||
    !placement.allowedRenderers.includes(config.renderer)
  )
    throw new ExperienceInvalidProblem("Config metadata is invalid");
  exactKeys(config.content, ["locale", "title", "body", "actionUrl"], "Content");
  text(config.content.locale, "Locale");
  text(config.content.title, "Title");
  text(config.content.body, "Body");
  if (
    !/^[a-z]{2,3}(?:-[A-Z]{2})?$/.test(config.content.locale) ||
    !placement.schema.content.locales.includes(config.content.locale) ||
    config.content.title.length > placement.schema.content.maxTitleLength ||
    config.content.body.length > placement.schema.content.maxBodyLength ||
    [config.content.title, config.content.body].some((value) => /[<>]/.test(value))
  )
    throw new ExperienceInvalidProblem("Content contains unsupported markup or locale");
  if (
    config.content.actionUrl !== undefined &&
    (!placement.schema.content.allowActionUrl || !safeActionUrl(config.content.actionUrl))
  )
    throw new ExperienceInvalidProblem("Action URL must be local or HTTPS");
  if (config.startAt !== undefined) timestamp(config.startAt);
  if (config.endAt !== undefined) timestamp(config.endAt);
  if (config.startAt && config.endAt && timestamp(config.startAt) >= timestamp(config.endAt))
    throw new ExperienceInvalidProblem("Config end must follow start");
  if (config.frequency !== undefined) {
    exactKeys(config.frequency, ["maxDisplays", "windowSeconds"], "Frequency");
    if (
      !Number.isSafeInteger(config.frequency.maxDisplays) ||
      config.frequency.maxDisplays < 1 ||
      !Number.isSafeInteger(config.frequency.windowSeconds) ||
      config.frequency.windowSeconds < 1
    )
      throw new ExperienceInvalidProblem("Frequency must use positive integers");
  }
  if (config.targeting !== undefined) {
    exactKeys(config.targeting, ["context", "staticSubjectIds", "cohortSnapshotId"], "Targeting");
    if (config.targeting.context !== undefined) {
      if (!Array.isArray(config.targeting.context))
        throw new ExperienceInvalidProblem("Context predicates must be an array");
      config.targeting.context.forEach((predicate) => validatePredicate(predicate, placement));
    }
    if (
      config.targeting.staticSubjectIds !== undefined &&
      (!Array.isArray(config.targeting.staticSubjectIds) ||
        config.targeting.staticSubjectIds.some((id) => typeof id !== "string" || !id) ||
        new Set(config.targeting.staticSubjectIds).size !==
          config.targeting.staticSubjectIds.length)
    )
      throw new ExperienceInvalidProblem("Static audience is invalid");
    if (config.targeting.cohortSnapshotId !== undefined)
      text(config.targeting.cohortSnapshotId, "Cohort snapshot id");
  }
}
function validateContext(context: ExperienceContext, placement: PlacementDefinition): void {
  exactKeys(context, Object.keys(placement.schema.contextFields), "Context");
  for (const [field, value] of Object.entries(context))
    if (scalarType(value) !== placement.schema.contextFields[field])
      throw new ExperienceInvalidProblem(`Context field ${field} has the wrong type`);
}
export type EvaluatePlacementInput = Readonly<{
  placement: PlacementDefinition;
  scope: ExperienceScope;
  subject: ExperienceSubject;
  context: ExperienceContext;
  locale?: string;
  store: ExperienceStore;
  cohortReader?: PublishedCohortReader;
  now?: Date;
  reservationSeconds?: number;
  onUnavailable?(cause: unknown): void;
  onInvalidStoredConfig?(configId: string, cause: ExperienceInvalidProblem): void;
}>;
export type PlacementEvaluation = Readonly<
  | { reason: "selected"; decision: ExperienceDecision; exposureHandle: ExposureHandle }
  | {
      reason: "no_match";
      detail: "no_candidate" | "reservation_rejected";
      decision: null;
      exposureHandle?: never;
    }
  | { reason: "unavailable"; decision: null; exposureHandle?: never }
>;

async function matches(
  config: ExperienceConfig,
  input: Pick<EvaluatePlacementInput, "scope" | "subject" | "context" | "cohortReader">,
  now: Date,
): Promise<{ matched: boolean; sourceSnapshotRef?: ExperienceSourceSnapshotRef }> {
  const targeting = config.targeting;
  if (!targeting) return { matched: true };
  if (
    targeting.context?.some((rule) => {
      const actual = input.context[rule.field];
      return rule.operator === "eq"
        ? actual !== rule.value
        : !rule.value.includes(actual as ExperienceScalar);
    })
  )
    return { matched: false };
  if (targeting.staticSubjectIds && !targeting.staticSubjectIds.includes(input.subject.id))
    return { matched: false };
  if (!targeting.cohortSnapshotId) return { matched: true };
  if (!input.cohortReader)
    throw new ExperienceUnavailableProblem("Published cohort reader is required");
  const publication = await input.cohortReader.read(
    targeting.cohortSnapshotId,
    input.scope,
    input.subject.kind,
    now,
  );
  const { snapshot } = publication;
  return {
    matched: publication.subjectIds.includes(input.subject.id),
    sourceSnapshotRef: {
      snapshotId: snapshot.snapshotId,
      scope: snapshot.scope,
      subjectKind: snapshot.subjectKind,
      definitionId: snapshot.definitionId,
      definitionVersion: snapshot.definitionVersion,
      schemaVersion: snapshot.schemaVersion,
      sourceSnapshotRefs: snapshot.sourceSnapshotRefs,
      asOf: snapshot.asOf,
      generatedAt: snapshot.generatedAt,
      validUntil: snapshot.validUntil,
      contentHash: snapshot.contentHash,
      publicationRevision: snapshot.publicationRevision,
      privacyVersion: snapshot.privacyVersion,
      membershipRef: snapshot.membershipRef,
    },
  };
}
/**
 * Skips stored configurations incompatible with the current placement schema only when
 * onInvalidStoredConfig reports each rejected configuration. Otherwise evaluation is unavailable.
 */
export async function evaluatePlacement(
  input: EvaluatePlacementInput,
): Promise<PlacementEvaluation> {
  const now = input.now ?? new Date();
  if (
    !scopeValid(input.scope) ||
    !input.subject.kind ||
    !input.subject.id ||
    !Number.isFinite(now.getTime())
  )
    throw new ExperienceInvalidProblem("Scope, subject, or time is invalid");
  validateContext(input.context, input.placement);
  validateLocale(input.locale);
  const reservationSeconds = input.reservationSeconds ?? 60;
  if (!Number.isSafeInteger(reservationSeconds) || reservationSeconds < 1)
    throw new ExperienceInvalidProblem("Reservation duration is invalid");
  try {
    const configs = await input.store.listConfigs(input.scope, input.placement.id);
    const candidates: ExperienceConfig[] = [];
    let invalidCandidateCause: ExperienceInvalidProblem | undefined;
    for (const config of configs) {
      if (config.status !== "published") continue;
      try {
        validateExperienceConfig(config, input.placement, input.scope);
        candidates.push(config);
      } catch (cause) {
        if (!(cause instanceof ExperienceInvalidProblem)) throw cause;
        invalidCandidateCause ??= cause;
        input.onInvalidStoredConfig?.(config.id, cause);
      }
    }
    if (invalidCandidateCause && !input.onInvalidStoredConfig) {
      input.onUnavailable?.(invalidCandidateCause);
      return { reason: "unavailable", decision: null };
    }
    candidates.sort((a, b) => b.priority - a.priority || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    let reservationRejected = false;
    for (const config of candidates) {
      if (input.locale !== undefined && config.content.locale !== input.locale) continue;
      if (
        (config.startAt && timestamp(config.startAt) > now.getTime()) ||
        (config.endAt && timestamp(config.endAt) <= now.getTime())
      )
        continue;
      const match = await matches(config, input, now);
      if (!match.matched) continue;
      const decisionId = globalThis.crypto.randomUUID();
      const selectedAt = now.toISOString();
      const expiresAt = new Date(
        Math.min(
          now.getTime() + reservationSeconds * 1000,
          config.endAt ? timestamp(config.endAt) : Infinity,
          match.sourceSnapshotRef ? timestamp(match.sourceSnapshotRef.validUntil) : Infinity,
        ),
      ).toISOString();
      const decision: ExperienceDecision = {
        decisionId,
        placementId: input.placement.id,
        configId: config.id,
        policyVersion: config.revision,
        scope: input.scope,
        subject: input.subject,
        renderer: config.renderer,
        content: config.content,
        selectedAt,
        expiresAt,
        reason: "matched",
        ...(match.sourceSnapshotRef ? { sourceSnapshotRef: match.sourceSnapshotRef } : {}),
      };
      const handle: ExposureHandle = {
        decisionId,
        exposureId: globalThis.crypto.randomUUID(),
        surfaceInstanceId: globalThis.crypto.randomUUID(),
        token: globalThis.crypto.randomUUID(),
      };
      if (await input.store.reserve({ receipt: { decision, handle }, frequency: config.frequency }))
        return { reason: "selected", decision, exposureHandle: handle };
      reservationRejected = true;
    }
    if (invalidCandidateCause) {
      input.onUnavailable?.(invalidCandidateCause);
      return { reason: "unavailable", decision: null };
    }
    return {
      reason: "no_match",
      detail: reservationRejected ? "reservation_rejected" : "no_candidate",
      decision: null,
    };
  } catch (cause) {
    if (cause instanceof ExperienceInvalidProblem) throw cause;
    input.onUnavailable?.(cause);
    return { reason: "unavailable", decision: null };
  }
}

export type PreviewPlacementInput = Readonly<
  Omit<EvaluatePlacementInput, "store" | "reservationSeconds"> & { config: ExperienceConfig }
>;
export async function previewPlacement(
  input: PreviewPlacementInput,
): Promise<Readonly<{ matched: boolean; sourceSnapshotRef?: ExperienceSourceSnapshotRef }>> {
  const now = input.now ?? new Date();
  if (
    !scopeValid(input.scope) ||
    !input.subject.kind ||
    !input.subject.id ||
    !Number.isFinite(now.getTime())
  )
    throw new ExperienceInvalidProblem("Scope, subject, or time is invalid");
  validateContext(input.context, input.placement);
  validateLocale(input.locale);
  validateExperienceConfig(input.config, input.placement, input.scope);
  if (input.locale !== undefined && input.config.content.locale !== input.locale)
    return { matched: false };
  if (
    (input.config.startAt && timestamp(input.config.startAt) > now.getTime()) ||
    (input.config.endAt && timestamp(input.config.endAt) <= now.getTime())
  )
    return { matched: false };
  return matches(input.config, input, now);
}

export async function recordExposure(
  store: ExperienceStore,
  input: ExperienceReceiptInput,
): Promise<"recorded" | "duplicate"> {
  if (!scopeValid(input.scope) || !input.subject.kind || !input.subject.id)
    throw new ExperienceInvalidProblem("Receipt identity is invalid");
  timestamp(input.at);
  return store.recordExposure(input);
}
export async function dismissExperience(
  store: ExperienceStore,
  input: ExperienceReceiptInput,
): Promise<void> {
  if (!scopeValid(input.scope) || !input.subject.kind || !input.subject.id)
    throw new ExperienceInvalidProblem("Receipt identity is invalid");
  timestamp(input.at);
  await store.dismiss(input);
}
export async function readExperienceDecision(
  store: ExperienceStore,
  scope: ExperienceScope,
  decisionId: string,
): Promise<StoredExperienceDecision | undefined> {
  if (!scopeValid(scope) || !decisionId)
    throw new ExperienceInvalidProblem("Decision identity is invalid");
  return store.readDecision(scope, decisionId);
}
