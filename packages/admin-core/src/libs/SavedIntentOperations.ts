import { Problem, ProblemCategory } from "@croco/problems-core";
import { sameExperienceScope } from "@croco/experience-core";
import type {
  ExperienceScope,
  ExperienceSubject,
  SavedIntentPolicy,
  SavedIntentPolicyInput,
  SavedIntentService,
} from "@croco/experience-core";

export type SavedIntentAdminPermission =
  | "saved-intent.read"
  | "saved-intent.write"
  | "saved-intent.inspect";
export type SavedIntentAdminAccess = Readonly<{
  scope: ExperienceScope;
  actorId: string;
  principal: unknown;
  permissions: readonly SavedIntentAdminPermission[];
}>;
export type SavedIntentInspection = Readonly<{
  rows: readonly Readonly<{
    intentId: string;
    resourceType: string;
    availability: "available" | "deleted" | "denied" | "expired";
    rankReason: "pinned" | "recent";
  }>[];
  exclusions: readonly Readonly<{ intentId: string; resourceType: string; reason: string }>[];
  nextOffset?: number;
}>;
export type SavedIntentAdminState =
  | Readonly<{ kind: "loading" }>
  | Readonly<{ kind: "denied" | "error"; message: string }>
  | Readonly<{ kind: "ready"; policies: readonly SavedIntentPolicy[] }>;

export class SavedIntentAdminDeniedProblem extends Problem {
  constructor() {
    super(
      "saved-intent/admin-denied",
      ProblemCategory.Forbidden,
      "Saved intent administration is not authorized",
    );
  }
}

/** Server adapter. Access must come from the verified server session, never the request body. */
export class SavedIntentOperations {
  constructor(private readonly service: SavedIntentService) {}

  private authorize(
    scope: ExperienceScope,
    access: SavedIntentAdminAccess,
    permission: SavedIntentAdminPermission,
  ): void {
    if (
      !access.actorId?.trim() ||
      !sameExperienceScope(scope, access.scope) ||
      !access.permissions.includes(permission)
    ) {
      throw new SavedIntentAdminDeniedProblem();
    }
  }

  async readPolicy(
    resourceType: string,
    subject: ExperienceSubject,
    access: SavedIntentAdminAccess,
  ): Promise<SavedIntentPolicy> {
    this.authorize(access.scope, access, "saved-intent.read");
    return this.service.readPolicy({
      scope: access.scope,
      subject,
      principal: access.principal,
      resourceType,
    });
  }

  async updatePolicy(
    input: Omit<SavedIntentPolicyInput, "principal" | "actorId">,
    access: SavedIntentAdminAccess,
  ): Promise<SavedIntentPolicy> {
    this.authorize(input.scope, access, "saved-intent.write");
    return this.service.updatePolicy({
      ...input,
      principal: access.principal,
      actorId: access.actorId,
    });
  }

  async inspect(
    subject: ExperienceSubject,
    access: SavedIntentAdminAccess,
    page: Readonly<{ offset?: number; limit?: number }> = {},
  ): Promise<SavedIntentInspection> {
    this.authorize(access.scope, access, "saved-intent.inspect");
    const result = await this.service.listResumeCandidates({
      ...page,
      scope: access.scope,
      subject,
      principal: access.principal,
      includeExclusions: true,
    });
    return {
      rows: result.candidates.map(({ intent, availability, rankReason }) => ({
        intentId: intent.id,
        resourceType: intent.resourceType,
        availability,
        rankReason,
      })),
      exclusions: result.exclusions,
      ...(result.nextOffset === undefined ? {} : { nextOffset: result.nextOffset }),
    };
  }
}
