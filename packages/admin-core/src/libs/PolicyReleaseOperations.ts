import { Problem, ProblemCategory } from "@croco/problems-core";
import type {
  PolicyActor,
  PolicyScope,
  PolicyReleaseService,
  PolicyRevision,
  PolicyFieldInput,
  PolicyValidationDiagnostic,
} from "@croco/features-core";

export type PolicyReleasePermission =
  | "policy.read"
  | "policy.write"
  | "policy.review"
  | "policy.publish";

/** Resolve on the server from the authenticated identity, never from request JSON. */
export type PolicyReleaseAccess = Readonly<{
  scope: PolicyScope & { readonly tenantId: string | null };
  actor: PolicyActor;
  permissions: readonly PolicyReleasePermission[];
}>;

export class PolicyReleaseAccessProblem extends Problem {
  constructor() {
    super(
      "features/policy/admin-denied",
      ProblemCategory.ValidationError,
      "Policy scope or permission denied",
    );
  }
}

export function assertPolicyReleaseAccess(
  access: PolicyReleaseAccess,
  scope: PolicyScope,
  permission: PolicyReleasePermission,
): void {
  if (
    access.scope.tenantId === undefined ||
    scope.tenantId === undefined ||
    !access.actor.id.trim() ||
    access.scope.app !== scope.app ||
    access.scope.environment !== scope.environment ||
    access.scope.tenantId !== scope.tenantId ||
    !access.permissions.includes(permission)
  ) {
    throw new PolicyReleaseAccessProblem();
  }
}

export type PolicyReleaseAdminTarget = Readonly<{ policyId: string; scope: PolicyScope }>;
export type PolicyReleaseAdminCommand = PolicyReleaseAdminTarget &
  Readonly<{
    expectedRevision: number;
    reason: string;
    idempotencyKey: string;
  }>;
export type PolicyReleaseAdminSnapshot = Readonly<{
  policyId: string;
  revision: number;
  status: string;
  fields: readonly Readonly<{
    key: string;
    label: string;
    input: PolicyFieldInput;
    min?: number;
    max?: number;
    options?: readonly Readonly<{ value: string; label: string }>[];
    value: unknown;
    sensitive: boolean;
  }>[];
  diagnostics: readonly Pick<PolicyValidationDiagnostic, "code" | "path" | "severity">[];
  diff: readonly Readonly<{ field: string; before: string; after: string }>[];
  impact: readonly Readonly<{ kind: "fact" | "estimate" | "insufficient-data"; message: string }>[];
  reviewHash?: string;
  reviewRequirements?: Readonly<{ risk: "low" | "financial"; independentReviewer: boolean }>;
  receipt?: Readonly<{ id: string; revision: number; status: string }>;
}>;

/** Authenticated server boundary; field writes and all transitions use the shared policy service. */
export class PolicyReleaseOperations {
  constructor(private readonly service: PolicyReleaseService) {}

  async read(
    target: PolicyReleaseAdminTarget,
    access: PolicyReleaseAccess,
  ): Promise<PolicyReleaseAdminSnapshot | null> {
    assertPolicyReleaseAccess(access, target.scope, "policy.read");
    const revision = await this.service.getLatestRevision(target.policyId, target.scope);
    return revision ? this.snapshot(revision) : null;
  }

  async edit(
    command: PolicyReleaseAdminCommand & Readonly<{ field: string; value: unknown }>,
    access: PolicyReleaseAccess,
  ): Promise<PolicyReleaseAdminSnapshot> {
    this.authorizeCommand(command, access, "policy.write");
    const revision = await this.service.updateDraftField({
      policyId: command.policyId,
      scope: command.scope,
      expectedRevision: command.expectedRevision,
      descriptorId: command.field,
      value: command.value,
      actor: access.actor,
      reason: command.reason,
    });
    return this.snapshot(revision);
  }

  async review(
    command: PolicyReleaseAdminCommand,
    access: PolicyReleaseAccess,
  ): Promise<PolicyReleaseAdminSnapshot> {
    this.authorizeCommand(command, access, "policy.review");
    return this.snapshot(await this.service.review({ ...command, actor: access.actor }));
  }

  async publish(
    command: PolicyReleaseAdminCommand & Readonly<{ reviewHash: string; effectiveAt?: string }>,
    access: PolicyReleaseAccess,
  ): Promise<PolicyReleaseAdminSnapshot> {
    this.authorizeCommand(command, access, "policy.publish");
    const revision = command.effectiveAt
      ? await this.service.schedule({
          ...command,
          effectiveAt: command.effectiveAt,
          actor: access.actor,
        })
      : await this.service.publish({ ...command, actor: access.actor });
    return this.snapshot(revision);
  }

  private authorizeCommand(
    command: PolicyReleaseAdminCommand,
    access: PolicyReleaseAccess,
    permission: PolicyReleasePermission,
  ): void {
    assertPolicyReleaseAccess(access, command.scope, permission);
    assertPolicyReleaseAccess(access, command.scope, "policy.read");
    if (
      !command.reason.trim() ||
      !command.idempotencyKey.trim() ||
      !Number.isSafeInteger(command.expectedRevision) ||
      command.expectedRevision < 1
    ) {
      throw new PolicyReleaseAccessProblem();
    }
  }

  private async snapshot(revision: PolicyRevision<unknown>): Promise<PolicyReleaseAdminSnapshot> {
    const definition = this.service.getRegistration(revision.policyId, revision.schemaVersion);
    if (
      !definition ||
      definition.codeRegistrationId !== revision.codeRegistrationId ||
      definition.registrationFingerprint !== revision.registrationFingerprint
    )
      throw new PolicyReleaseAccessProblem();
    const sensitive = definition.fieldDescriptors.some((field) => field.sensitive);
    const receiptKey = revision.publication?.idempotencyKey ?? revision.scheduleIdempotencyKey;
    const receipt = receiptKey
      ? await this.service.getCommandReceipt(revision.policyId, revision.scope, receiptKey)
      : null;
    return {
      policyId: revision.policyId,
      revision: revision.revision,
      status: revision.state,
      fields: definition.fieldDescriptors.map((field) => ({
        key: field.id,
        label: field.label,
        input: field.input,
        min: field.min,
        max: field.max,
        options: field.options,
        value: field.sensitive ? null : field.read(revision.value),
        sensitive: field.sensitive === true,
      })),
      diagnostics:
        revision.review?.validation.diagnostics.map(({ code, path, severity }) => ({
          code,
          path,
          severity,
        })) ?? [],
      diff: (revision.review?.semanticDiff ?? []).map((change) => ({
        field: change.field,
        before:
          sensitive || change.sensitive
            ? "[redacted]"
            : (JSON.stringify(change.before) ?? "not set"),
        after:
          sensitive || change.sensitive
            ? "[redacted]"
            : (JSON.stringify(change.after) ?? "not set"),
      })),
      impact: [
        { kind: "fact", message: `Revision ${revision.revision} is ${revision.state}` },
        { kind: "insufficient-data", message: "No audience or outcome estimate was supplied" },
      ],
      reviewHash: revision.review?.reviewedHash,
      reviewRequirements: definition.reviewRequirements,
      ...(receipt
        ? {
            receipt: {
              id: receipt.idempotencyKey,
              revision: receipt.revision,
              status: receipt.status,
            },
          }
        : {}),
    };
  }
}
