import { randomUUID } from 'node:crypto';
import type { EventPublisher } from '@croco/events-core';
import { Component } from '@croco/framework-context';
import {
  AlreadyMemberProblem,
  type Membership,
  type MembershipManager,
  type MembershipRole,
} from '@croco/membership-core';
import type { DomainPolicyStore } from './DomainPolicyStore';
import { DomainAutoJoinedEvent, DomainPolicyAddedEvent, DomainPolicyRemovedEvent } from './events/DomainPolicyEvents';
import { InvalidAutoJoinRoleProblem, PublicEmailDomainNotAllowedProblem } from './problems/DomainPolicyProblems';
import { type DomainPolicy, PUBLIC_EMAIL_DOMAINS } from './types';

const AUTO_JOIN_ROLES: MembershipRole[] = ['member', 'viewer'];

@Component()
export class DomainPolicyManager {
  constructor(
    private readonly store: DomainPolicyStore,
    private readonly membershipManager: MembershipManager,
    private readonly eventPublisher: EventPublisher
  ) {}

  async addDomainPolicy(tenantId: string, domain: string, role: MembershipRole): Promise<DomainPolicy> {
    this.ensureAutoJoinRole(role);

    const normalizedDomain = this.normalizeDomain(domain);
    this.ensureNonPublicDomain(normalizedDomain);

    const policy = await this.store.save({
      id: randomUUID(),
      tenantId,
      domain: normalizedDomain,
      role,
      enabled: true,
      createdAt: new Date(),
    });

    await this.publishSafely(new DomainPolicyAddedEvent({ tenantId, domain: normalizedDomain, role }));
    return policy;
  }

  async removeDomainPolicy(tenantId: string, domain: string): Promise<void> {
    const normalizedDomain = this.normalizeDomain(domain);
    await this.store.delete(tenantId, normalizedDomain);
    await this.publishSafely(new DomainPolicyRemovedEvent({ tenantId, domain: normalizedDomain }));
  }

  async listDomainPolicies(tenantId: string): Promise<DomainPolicy[]> {
    return this.store.findAllByTenant(tenantId);
  }

  async tryAutoJoin(tenantId: string, userId: string, email: string): Promise<Membership | null> {
    const domain = this.extractEmailDomain(email);
    if (!domain) {
      return null;
    }

    const policy = await this.store.findByTenantAndDomain(tenantId, domain);
    if (!policy || !policy.enabled) {
      return null;
    }

    try {
      const membership = await this.membershipManager.addMember(tenantId, userId, policy.role);
      await this.publishSafely(
        new DomainAutoJoinedEvent({
          tenantId,
          userId,
          email: email.trim().toLowerCase(),
          domain,
          role: policy.role,
        })
      );
      return membership;
    } catch (error) {
      if (error instanceof AlreadyMemberProblem) {
        return null;
      }

      throw error;
    }
  }

  private normalizeDomain(domain: string): string {
    return domain.trim().toLowerCase().replace(/^@+/, '');
  }

  private extractEmailDomain(email: string): string | null {
    const normalizedEmail = email.trim().toLowerCase();
    const [, domain = ''] = normalizedEmail.split('@');
    const normalizedDomain = this.normalizeDomain(domain);
    return normalizedDomain ? normalizedDomain : null;
  }

  private ensureNonPublicDomain(domain: string): void {
    if (PUBLIC_EMAIL_DOMAINS.includes(domain as (typeof PUBLIC_EMAIL_DOMAINS)[number])) {
      throw new PublicEmailDomainNotAllowedProblem(domain);
    }
  }

  private ensureAutoJoinRole(role: MembershipRole): void {
    if (!AUTO_JOIN_ROLES.includes(role)) {
      throw new InvalidAutoJoinRoleProblem(role);
    }
  }

  private async publishSafely(
    event: DomainPolicyAddedEvent | DomainPolicyRemovedEvent | DomainAutoJoinedEvent
  ): Promise<void> {
    try {
      await this.eventPublisher.publish(event);
    } catch {}
  }
}
