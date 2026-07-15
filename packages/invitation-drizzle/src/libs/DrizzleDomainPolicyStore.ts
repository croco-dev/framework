// Constructor dependencies must remain runtime values for emitted design:paramtypes metadata.
/* oxlint-disable typescript/consistent-type-imports */
import { Component, Inject, Token } from "@croco/framework-context";
import { type DomainPolicy, DomainPolicyStore } from "@croco/invitation-core";
import { TxManager } from "@croco/tx-core";
import type { DrizzleDb } from "@croco/tx-drizzle";
import { and, eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { domainPolicies } from "./schema";

type DrizzleDomainPolicyClient = DrizzleDb & NodePgDatabase<Record<string, never>>;

interface DomainPolicyRow {
  id: string;
  tenantId: string;
  domain: string;
  role: "owner" | "admin" | "member" | "viewer";
  enabled: boolean;
  createdAt: Date;
}

/**
 * 도메인 정책 저장소용 Drizzle 클라이언트 주입 토큰입니다.
 */
export const DRIZZLE_DOMAIN_POLICY_TOKEN = new Token<DrizzleDomainPolicyClient>(
  "DRIZZLE_DOMAIN_POLICY_TOKEN",
);

/**
 * 도메인 정책 저장소에서 사용하는 Drizzle 클라이언트 타입입니다.
 */
export type { DrizzleDomainPolicyClient };

/**
 * 도메인 정책 엔터티를 Drizzle로 저장하고 조회하는 구현체입니다.
 */
@Component()
export class DrizzleDomainPolicyStore extends DomainPolicyStore {
  /**
   * Drizzle 클라이언트와 트랜잭션 매니저를 받아 저장소를 초기화합니다.
   */
  constructor(
    @Inject(DRIZZLE_DOMAIN_POLICY_TOKEN) private readonly db: DrizzleDomainPolicyClient,
    private readonly txManager: TxManager<DrizzleDomainPolicyClient>,
  ) {
    super();
  }

  /**
   * 테넌트와 도메인 조합으로 정책을 조회합니다.
   */
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

  /**
   * 테넌트의 모든 도메인 정책을 조회합니다.
   */
  async findAllByTenant(tenantId: string): Promise<DomainPolicy[]> {
    const client = this.txManager.getClient() ?? this.db;

    const result = (await client
      .select()
      .from(domainPolicies)
      .where(eq(domainPolicies.tenantId, tenantId))) as DomainPolicyRow[];
    return result.map((row) => this.mapToDomainPolicy(row));
  }

  /**
   * 도메인 정책을 upsert 방식으로 저장합니다.
   */
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

  /**
   * 테넌트와 도메인 조합의 정책을 삭제합니다.
   */
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
