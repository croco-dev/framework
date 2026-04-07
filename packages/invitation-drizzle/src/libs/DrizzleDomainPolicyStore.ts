import { Component, Inject, Token } from '@croco/framework-context';
import { type DomainPolicy, DomainPolicyStore } from '@croco/invitation-core';
import type { TxManager } from '@croco/tx-core';
import type { DrizzleDb } from '@croco/tx-drizzle';
import { and, eq } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { domainPolicies } from './schema';

type DrizzleDomainPolicyClient = DrizzleDb & NodePgDatabase<Record<string, never>>;

interface DomainPolicyRow {
  id: string;
  tenantId: string;
  domain: string;
  role: 'owner' | 'admin' | 'member' | 'viewer';
  enabled: boolean;
  createdAt: Date;
}

export const DRIZZLE_DOMAIN_POLICY_TOKEN = new Token<DrizzleDomainPolicyClient>('DRIZZLE_DOMAIN_POLICY_TOKEN');

export type { DrizzleDomainPolicyClient };

@Component()
export class DrizzleDomainPolicyStore extends DomainPolicyStore {
  constructor(
    @Inject(DRIZZLE_DOMAIN_POLICY_TOKEN) private readonly db: DrizzleDomainPolicyClient,
    private readonly txManager: TxManager<DrizzleDomainPolicyClient>
  ) {
    super();
  }

  async findByTenantAndDomain(tenantId: string, domain: string): Promise<DomainPolicy | null> {
    const client = this.txManager.getClient() ?? this.db;

    const result = (await client
      .select()
      .from(domainPolicies)
      .where(and(eq(domainPolicies.tenantId, tenantId), eq(domainPolicies.domain, domain)))
      .limit(1)) as DomainPolicyRow[];

    if (result.length === 0) {
      return null;
    }

    return this.mapToDomainPolicy(result[0]);
  }

  async findAllByTenant(tenantId: string): Promise<DomainPolicy[]> {
    const client = this.txManager.getClient() ?? this.db;

    const result = (await client
      .select()
      .from(domainPolicies)
      .where(eq(domainPolicies.tenantId, tenantId))) as DomainPolicyRow[];
    return result.map((row) => this.mapToDomainPolicy(row));
  }

  async save(policy: DomainPolicy): Promise<DomainPolicy> {
    const client = this.txManager.getClient() ?? this.db;

    const result = (await client
      .insert(domainPolicies)
      .values({
        id: policy.id,
        tenantId: policy.tenantId,
        domain: policy.domain,
        role: policy.role,
        enabled: policy.enabled,
        createdAt: policy.createdAt,
      })
      .onConflictDoUpdate({
        target: [domainPolicies.tenantId, domainPolicies.domain],
        set: {
          id: policy.id,
          role: policy.role,
          enabled: policy.enabled,
          createdAt: policy.createdAt,
        },
      })
      .returning()) as DomainPolicyRow[];

    return this.mapToDomainPolicy(result[0]);
  }

  async delete(tenantId: string, domain: string): Promise<void> {
    const client = this.txManager.getClient() ?? this.db;

    await client
      .delete(domainPolicies)
      .where(and(eq(domainPolicies.tenantId, tenantId), eq(domainPolicies.domain, domain)));
  }

  private mapToDomainPolicy(row: DomainPolicyRow): DomainPolicy {
    return {
      id: row.id,
      tenantId: row.tenantId,
      domain: row.domain,
      role: row.role,
      enabled: row.enabled,
      createdAt: row.createdAt,
    };
  }
}
