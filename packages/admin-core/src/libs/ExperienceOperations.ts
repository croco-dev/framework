import { Problem, ProblemCategory } from "@croco/problems-core";
import {
  previewPlacement,
  sameExperienceScope,
  validateExperienceConfig,
} from "@croco/experience-core";
import type {
  ExperienceConfig,
  ExperienceContext,
  ExperienceScope,
  ExperienceStore,
  ExperienceSubject,
  PlacementDefinition,
} from "@croco/experience-core";
import type { PublishedCohortReader } from "@croco/cohort-core";

export type ExperienceAdminPermission =
  | "experience.read"
  | "experience.preview"
  | "experience.write"
  | "experience.publish";
export type ExperienceAdminAccess = Readonly<{
  scope: ExperienceScope;
  permissions: readonly ExperienceAdminPermission[];
  fields: readonly string[];
  actorId: string;
}>;
export type ExperienceAdminPreview = Readonly<{
  matched: boolean;
  renderer: string;
  content: ExperienceConfig["content"];
  sourceSnapshotId?: string;
}>;
export type ExperienceAdminState =
  | Readonly<{ kind: "loading" }>
  | Readonly<{ kind: "denied" | "failed"; code: string }>
  | Readonly<{
      kind: "ready";
      configs: readonly ExperienceConfig[];
      preview?: ExperienceAdminPreview;
    }>;

export class ExperienceAdminProblem extends Problem {
  constructor(detail: string) {
    super("experience/admin-denied", ProblemCategory.ValidationError, detail);
  }
}

const EDITABLE_FIELDS = [
  "renderer",
  "content.locale",
  "content.title",
  "content.body",
  "content.actionUrl",
  "targeting.context",
  "targeting.staticSubjectIds",
  "targeting.cohortSnapshotId",
  "priority",
  "startAt",
  "endAt",
  "frequency",
] as const;

function authorize(
  access: ExperienceAdminAccess,
  scope: ExperienceScope,
  permission: ExperienceAdminPermission,
): void {
  if (
    !access.actorId ||
    !sameExperienceScope(access.scope, scope) ||
    !access.permissions.includes(permission)
  )
    throw new ExperienceAdminProblem("Experience scope or permission denied");
}

function valueAt(config: ExperienceConfig | undefined, field: string): unknown {
  if (!config) return undefined;
  const [first, second] = field.split(".");
  const value = config[first as keyof ExperienceConfig];
  return second && value && typeof value === "object"
    ? (value as Record<string, unknown>)[second]
    : value;
}

function authorizeConfigFields(config: ExperienceConfig, access: ExperienceAdminAccess): void {
  for (const field of EDITABLE_FIELDS)
    if (valueAt(config, field) !== undefined && !access.fields.includes(field))
      throw new ExperienceAdminProblem(`Field permission denied: ${field}`);
  for (const predicate of config.targeting?.context ?? [])
    if (!access.fields.includes(`context.${predicate.field}`))
      throw new ExperienceAdminProblem("Context field permission denied");
}

/** Server boundary for scoped reads, previews, and audited configuration changes. */
export class ExperienceOperations {
  constructor(
    private readonly store: ExperienceStore,
    private readonly placements: Readonly<Record<string, PlacementDefinition>>,
    private readonly cohortReader?: PublishedCohortReader,
  ) {}

  private placement(id: string): PlacementDefinition {
    const placement = Object.hasOwn(this.placements, id) ? this.placements[id] : undefined;
    if (!placement) throw new ExperienceAdminProblem("Placement is not registered");
    return placement;
  }

  async list(
    placementId: string,
    access: ExperienceAdminAccess,
  ): Promise<readonly ExperienceConfig[]> {
    authorize(access, access.scope, "experience.read");
    this.placement(placementId);
    const configs = await this.store.listConfigs(access.scope, placementId);
    for (const config of configs) authorizeConfigFields(config, access);
    return configs;
  }

  async preview(
    config: ExperienceConfig,
    subject: ExperienceSubject,
    context: ExperienceContext,
    access: ExperienceAdminAccess,
    now = new Date(),
  ): Promise<ExperienceAdminPreview> {
    authorize(access, config.scope, "experience.preview");
    const placement = this.placement(config.placementId);
    validateExperienceConfig(config, placement, access.scope);
    authorizeConfigFields(config, access);
    const result = await previewPlacement({
      config,
      placement,
      scope: access.scope,
      subject,
      context,
      cohortReader: this.cohortReader,
      now,
    });
    return {
      matched: result.matched,
      renderer: config.renderer,
      content: config.content,
      sourceSnapshotId: result.sourceSnapshotRef?.snapshotId,
    };
  }

  async save(
    config: ExperienceConfig,
    access: ExperienceAdminAccess,
    input: Readonly<{ expectedRevision: number | null; reason: string; idempotencyKey: string }>,
  ): Promise<ExperienceConfig> {
    authorize(access, config.scope, "experience.write");
    const placement = this.placement(config.placementId);
    validateExperienceConfig(config, placement, access.scope);
    if (!input.reason.trim() || !input.idempotencyKey.trim())
      throw new ExperienceAdminProblem("Audit reason and idempotency key are required");
    const prior = (await this.store.listConfigs(access.scope, config.placementId)).find(
      (item) => item.id === config.id,
    );
    if (config.status !== "draft" || (prior && prior.status !== "draft"))
      authorize(access, config.scope, "experience.publish");
    for (const field of EDITABLE_FIELDS) {
      if (
        JSON.stringify(valueAt(prior, field)) !== JSON.stringify(valueAt(config, field)) &&
        !access.fields.includes(field)
      )
        throw new ExperienceAdminProblem(`Field permission denied: ${field}`);
    }
    for (const predicate of config.targeting?.context ?? [])
      if (!access.fields.includes(`context.${predicate.field}`))
        throw new ExperienceAdminProblem("Context field permission denied");
    return this.store.saveConfig({
      config,
      expectedRevision: input.expectedRevision,
      actorId: access.actorId,
      reason: input.reason,
      idempotencyKey: input.idempotencyKey,
    });
  }
}
