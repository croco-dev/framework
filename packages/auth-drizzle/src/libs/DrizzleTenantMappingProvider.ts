import type { TenantMappingProvider } from '@croco/auth-core';
import type { SQLWrapper } from 'drizzle-orm';
import { eq } from 'drizzle-orm';
import type { tenantMappings as tenantMappingsSchema } from '../schema';

interface DrizzleDb {
  insert: (table: unknown) => {
    values: (data: unknown) => Promise<unknown>;
  };
  delete: (table: unknown) => {
    where: (condition: SQLWrapper) => Promise<unknown>;
  };
  query: {
    tenantMappings: {
      findFirst: (args: { where: SQLWrapper }) => Promise<unknown>;
    };
  };
}

interface TenantMappingRow {
  id: string;
  externalOrgId: string;
  tenantId: string;
  createdAt: Date;
  updatedAt: Date;
}

function assertTenantMappingRow(row: unknown): row is TenantMappingRow {
  if (!row || typeof row !== 'object') {
    return false;
  }
  const record = row as Record<string, unknown>;
  return (
    typeof record.id === 'string' &&
    typeof record.externalOrgId === 'string' &&
    typeof record.tenantId === 'string' &&
    record.createdAt instanceof Date &&
    record.updatedAt instanceof Date
  );
}

/**
 * 외부 조직 ID와 내부 테넌트 ID를 매핑하는 Drizzle 구현체입니다.
 */
export class DrizzleTenantMappingProvider implements TenantMappingProvider {
  /**
   * Drizzle DB와 테넌트 매핑 스키마를 받아 제공자를 초기화합니다.
   */
  constructor(
    private readonly db: DrizzleDb,
    private readonly schema: { tenantMappings: typeof tenantMappingsSchema }
  ) {}

  /**
   * 외부 조직 ID에 연결된 테넌트 ID를 조회합니다.
   */
  async resolve(externalOrgId: string): Promise<string | null> {
    const row = await this.db.query.tenantMappings.findFirst({
      where: eq(this.schema.tenantMappings.externalOrgId, externalOrgId),
    });

    if (!assertTenantMappingRow(row)) {
      return null;
    }

    return row.tenantId;
  }

  /**
   * 외부 조직 ID와 테넌트 ID 매핑을 등록합니다.
   */
  async register(externalOrgId: string, tenantId: string): Promise<void> {
    await this.db.insert(this.schema.tenantMappings).values({
      externalOrgId,
      tenantId,
    });
  }

  /**
   * 외부 조직 ID 매핑을 제거합니다.
   */
  async remove(externalOrgId: string): Promise<void> {
    await this.db.delete(this.schema.tenantMappings).where(eq(this.schema.tenantMappings.externalOrgId, externalOrgId));
  }
}
