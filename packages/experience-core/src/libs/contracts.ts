import type { CohortSnapshot } from "@croco/cohort-core";

export type ExperienceScope = Readonly<{ appId: string; environment: string; tenantId: string }>;
export type ExperienceScalar = string | number | boolean;
export type ExperienceSubject = Readonly<{ kind: string; id: string }>;
export type ExperienceContext = Readonly<Record<string, ExperienceScalar>>;
export type PlacementDefinition = Readonly<{
  id: string;
  schema: Readonly<{
    contextFields: Readonly<Record<string, "string" | "number" | "boolean">>;
    content: Readonly<{
      locales: readonly string[];
      maxTitleLength: number;
      maxBodyLength: number;
      allowActionUrl: boolean;
    }>;
  }>;
  allowedRenderers: readonly string[];
}>;
export type ExperienceContent = Readonly<{
  locale: string;
  title: string;
  body: string;
  actionUrl?: string;
}>;
export type ExperienceContextPredicate = Readonly<
  | { field: string; operator: "eq"; value: ExperienceScalar }
  | { field: string; operator: "in"; value: readonly ExperienceScalar[] }
>;
export type ExperienceTargeting = Readonly<{
  context?: readonly ExperienceContextPredicate[];
  staticSubjectIds?: readonly string[];
  cohortSnapshotId?: string;
}>;
export type ExperienceFrequency = Readonly<{ maxDisplays: number; windowSeconds: number }>;
export type ExperienceConfig = Readonly<{
  id: string;
  placementId: string;
  scope: ExperienceScope;
  revision: number;
  status: "draft" | "published" | "paused" | "archived";
  renderer: string;
  content: ExperienceContent;
  targeting?: ExperienceTargeting;
  priority: number;
  startAt?: string;
  endAt?: string;
  frequency?: ExperienceFrequency;
}>;
export type ExperienceSourceSnapshotRef = Readonly<
  Pick<
    CohortSnapshot,
    | "snapshotId"
    | "scope"
    | "subjectKind"
    | "definitionId"
    | "definitionVersion"
    | "schemaVersion"
    | "sourceSnapshotRefs"
    | "asOf"
    | "generatedAt"
    | "validUntil"
    | "contentHash"
    | "publicationRevision"
    | "privacyVersion"
    | "membershipRef"
  >
>;
export type ExperienceDecision = Readonly<{
  decisionId: string;
  placementId: string;
  configId: string;
  policyVersion: number;
  scope: ExperienceScope;
  subject: ExperienceSubject;
  renderer: string;
  content: ExperienceContent;
  selectedAt: string;
  expiresAt: string;
  reason: "matched";
  sourceSnapshotRef?: ExperienceSourceSnapshotRef;
}>;
export type ExposureHandle = Readonly<{
  decisionId: string;
  exposureId: string;
  surfaceInstanceId: string;
  token: string;
}>;
export type StoredExperienceDecision = Readonly<{
  decision: ExperienceDecision;
  handle: ExposureHandle;
}>;
export type ExperienceSaveInput = Readonly<{
  config: ExperienceConfig;
  expectedRevision: number | null;
  actorId: string;
  reason: string;
  idempotencyKey: string;
}>;
export type ExperienceReserveInput = Readonly<{
  receipt: StoredExperienceDecision;
  frequency?: ExperienceFrequency;
}>;
export type ExperienceReceiptInput = Readonly<{
  scope: ExperienceScope;
  subject: ExperienceSubject;
  handle: ExposureHandle;
  at: string;
}>;
export interface ExperienceStore {
  listConfigs(scope: ExperienceScope, placementId: string): Promise<readonly ExperienceConfig[]>;
  saveConfig(input: ExperienceSaveInput): Promise<ExperienceConfig>;
  reserve(input: ExperienceReserveInput): Promise<boolean>;
  readDecision(
    scope: ExperienceScope,
    decisionId: string,
  ): Promise<StoredExperienceDecision | undefined>;
  recordExposure(input: ExperienceReceiptInput): Promise<"recorded" | "duplicate">;
  dismiss(input: ExperienceReceiptInput): Promise<void>;
}
