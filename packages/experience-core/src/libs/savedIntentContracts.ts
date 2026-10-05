import type { ExperienceScope, ExperienceSubject } from "./contracts";

export type SavedIntentSourceKind = "explicit" | "recent";
export type SavedIntent = Readonly<{
  id: string;
  scope: ExperienceScope;
  subject: ExperienceSubject;
  resourceType: string;
  resourceId: string;
  sourceKind: SavedIntentSourceKind;
  progressRef?: string;
  state: "saved" | "completed" | "removed";
  savedAt: string;
  lastUsedAt: string;
  updatedAt: string;
  revision: number;
  pinOrder?: number;
}>;
export type SavedIntentResourceResolution = Readonly<
  | { availability: "available"; label: string; safeUrl: string }
  | { availability: "deleted" | "denied" | "expired" }
>;
export type ResourceResolver = (
  input: Readonly<{
    scope: ExperienceScope;
    subject: ExperienceSubject;
    resourceType: string;
    resourceId: string;
    principal: unknown;
  }>,
) => Promise<SavedIntentResourceResolution>;
export type SavedIntentResourceType = Readonly<{
  id: string;
  resolver: ResourceResolver;
  allowedOrigins: readonly string[];
  defaultPolicy: Readonly<{
    displayLimit: number;
    retentionDays: number;
    excludeCompleted: boolean;
  }>;
}>;
export type SavedIntentPolicy = Readonly<{
  scope: ExperienceScope;
  resourceType: string;
  displayLimit: number;
  retentionDays: number;
  excludeCompleted: boolean;
  revision: number;
  actorId: string;
  reason: string;
  updatedAt: string;
}>;
export type SavedIntentAccess = Readonly<{
  scope: ExperienceScope;
  subject: ExperienceSubject;
  principal: unknown;
}>;
export type SavedIntentAuthorization = (
  input: SavedIntentAccess &
    Readonly<{
      action:
        | "read"
        | "write"
        | "policy:read"
        | "policy:write"
        | "privacy:delete"
        | "inspect"
        | "retention:purge";
      actorId?: string;
    }>,
) => Promise<boolean>;
export type SavedIntentMutation = Readonly<{
  scope: ExperienceScope;
  subject: ExperienceSubject;
  resourceType: string;
  resourceId: string;
  sourceKind: SavedIntentSourceKind;
  expectedRevision: number | null;
  idempotencyKey: string;
  operation: "save" | "remove" | "complete" | "pin";
  progressRef?: string;
  pinOrder?: number | null;
  id: string;
  now: string;
}>;
export type SavedIntentPolicyMutation = Readonly<{
  policy: SavedIntentPolicy;
  expectedRevision: number | null;
  idempotencyKey: string;
}>;
/** Implement atomically: receipt equality, resource suppression, unique key and revision CAS. */
export interface SavedIntentStore {
  mutate(input: SavedIntentMutation): Promise<SavedIntent>;
  list(
    input: Readonly<{
      scope: ExperienceScope;
      subject: ExperienceSubject;
      offset: number;
      limit: number;
    }>,
  ): Promise<readonly SavedIntent[]>;
  readPolicy(
    input: Readonly<{ scope: ExperienceScope; resourceType: string }>,
  ): Promise<SavedIntentPolicy | undefined>;
  updatePolicy(input: SavedIntentPolicyMutation): Promise<SavedIntentPolicy>;
  /** Purge expired private rows and receipts; retain minimal resource suppression. */
  purgeExpired(
    input: Readonly<{
      scope: ExperienceScope;
      subject: ExperienceSubject;
      resourceType: string;
      before: string;
    }>,
  ): Promise<void>;
  /** Delete intents, suppression and idempotency receipts for this exact subject. */
  deleteSubject(
    input: Readonly<{ scope: ExperienceScope; subject: ExperienceSubject }>,
  ): Promise<void>;
}
export type ResolvedCandidate = Readonly<{
  intent: SavedIntent;
  availability: "available" | "deleted" | "denied" | "expired";
  label?: string;
  safeUrl?: string;
  rankReason: "pinned" | "recent";
}>;
export type SavedIntentExclusion = Readonly<{
  intentId: string;
  resourceType: string;
  reason: "removed" | "completed" | "retention" | "duplicate" | "display-limit";
}>;
export type SavedIntentPage = Readonly<{
  candidates: readonly ResolvedCandidate[];
  exclusions: readonly SavedIntentExclusion[];
  nextOffset?: number;
}>;
export type SaveIntentInput = SavedIntentAccess &
  Readonly<{
    resourceType: string;
    resourceId: string;
    sourceKind: SavedIntentSourceKind;
    progressRef?: string;
    expectedRevision: number | null;
    idempotencyKey: string;
  }>;
export type MutateSavedIntentInput = Omit<SaveIntentInput, "progressRef">;
export type SavedIntentPolicyInput = SavedIntentAccess &
  Readonly<{
    resourceType: string;
    displayLimit: number;
    retentionDays: number;
    excludeCompleted: boolean;
    expectedRevision: number | null;
    idempotencyKey: string;
    actorId: string;
    reason: string;
  }>;
export interface SavedIntentService {
  saveIntent(input: SaveIntentInput): Promise<SavedIntent>;
  removeIntent(input: MutateSavedIntentInput): Promise<SavedIntent>;
  markCompleted(input: MutateSavedIntentInput): Promise<SavedIntent>;
  pinIntent(
    input: MutateSavedIntentInput & Readonly<{ pinOrder: number | null }>,
  ): Promise<SavedIntent>;
  listResumeCandidates(
    input: SavedIntentAccess &
      Readonly<{ offset?: number; limit?: number; includeExclusions?: boolean }>,
  ): Promise<SavedIntentPage>;
  readPolicy(
    input: SavedIntentAccess & Readonly<{ resourceType: string }>,
  ): Promise<SavedIntentPolicy>;
  updatePolicy(input: SavedIntentPolicyInput): Promise<SavedIntentPolicy>;
  readIntent(
    input: SavedIntentAccess &
      Readonly<{ resourceType: string; resourceId: string; sourceKind: SavedIntentSourceKind }>,
  ): Promise<SavedIntent | undefined>;
  resolveIntent(
    input: SavedIntentAccess &
      Readonly<{ resourceType: string; resourceId: string; sourceKind: SavedIntentSourceKind }>,
  ): Promise<ResolvedCandidate>;
  purgeRetention(input: SavedIntentAccess): Promise<void>;
  deleteSubject(input: SavedIntentAccess): Promise<void>;
}
