import type { Membership } from "@croco/membership-core";
import type {
  DomainAutoJoinIntent,
  DomainAutoJoinIntentCreation,
  DomainAutoJoinIntentInput,
  DomainPolicy,
} from "./types";

export abstract class DomainPolicyStore {
  abstract findByTenantAndDomain(tenantId: string, domain: string): Promise<DomainPolicy | null>;
  abstract findAllByTenant(tenantId: string): Promise<DomainPolicy[]>;
  abstract save(policy: DomainPolicy): Promise<DomainPolicy>;
  abstract delete(tenantId: string, domain: string): Promise<void>;
  abstract createAutoJoinIntent(
    input: DomainAutoJoinIntentInput,
  ): Promise<DomainAutoJoinIntentCreation>;
  abstract findAutoJoinIntent(
    tenantId: string,
    idempotencyKey: string,
  ): Promise<DomainAutoJoinIntent | null>;
  abstract completeAutoJoinMembership(
    tenantId: string,
    idempotencyKey: string,
    membership: Membership,
  ): Promise<DomainAutoJoinIntent | null>;
  abstract claimAutoJoinEvent(
    tenantId: string,
    idempotencyKey: string,
    claimId: string,
    claimExpiresAt: Date,
  ): Promise<DomainAutoJoinIntent | null>;
  abstract completeAutoJoinEvent(
    tenantId: string,
    idempotencyKey: string,
    claimId: string,
  ): Promise<DomainAutoJoinIntent | null>;
  abstract releaseAutoJoinEvent(
    tenantId: string,
    idempotencyKey: string,
    claimId: string,
  ): Promise<void>;
  abstract deleteUncommittedAutoJoinIntent(tenantId: string, idempotencyKey: string): Promise<void>;
}
