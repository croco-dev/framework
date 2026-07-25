import type {
  Membership,
  MembershipOwnerMutationInput,
  MembershipOwnerMutationResult,
  MembershipOwnershipTransferInput,
  MembershipOwnershipTransferResult,
  MembershipRole,
} from "./types";

export abstract class MembershipStore {
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
