import type {
  Membership,
  MembershipCommand,
  MembershipCommandResult,
  MembershipOwnerMutationInput,
  MembershipOwnerMutationResult,
  MembershipOwnershipTransferInput,
  MembershipOwnershipTransferResult,
  MembershipRole,
} from "./types";
import type { MembershipEventIntent } from "./eventIntent";

export abstract class MembershipStore {
  abstract readonly eventIntentDurability: "persistent" | "volatile";
  abstract hasExecutedCommand(idempotencyKey: string): Promise<boolean>;
  abstract execute(command: MembershipCommand): Promise<MembershipCommandResult>;
  abstract getPendingEventIntent(idempotencyKey: string): Promise<MembershipEventIntent | null>;
  abstract listPendingEventIntents(limit?: number): Promise<readonly MembershipEventIntent[]>;
  abstract markEventIntentPublished(intentId: string): Promise<void>;
  abstract findByTenantAndUser(tenantId: string, userId: string): Promise<Membership | null>;
  abstract findAllByTenant(tenantId: string): Promise<Membership[]>;
  abstract findAllByUser(userId: string): Promise<Membership[]>;
  abstract save(input: {
    id: string;
    tenantId: string;
    userId: string;
    role: MembershipRole;
  }): Promise<Membership>;
  abstract delete(tenantId: string, userId: string): Promise<void>;
  /**
   * Applies an owner removal or demotion as one atomic transition.
   *
   * Implementations must serialize competing mutations for the same tenant so the final owner
   * cannot be removed or demoted between validation and persistence. Serialization failures must
   * be returned as `conflict`.
   */
  abstract mutateOwner(input: MembershipOwnerMutationInput): Promise<MembershipOwnerMutationResult>;
  /**
   * Transfers ownership as one atomic transition. Serialization failures must be returned as
   * `conflict`.
   */
  abstract transferOwnership(
    input: MembershipOwnershipTransferInput,
  ): Promise<MembershipOwnershipTransferResult>;
  abstract countByRole(tenantId: string, role: MembershipRole): Promise<number>;
  abstract countAll(tenantId: string): Promise<number>;
}
