import type { AbstractRoleRegistry, RoleDefinition } from "@croco/auth-core";
import type { SQL } from "drizzle-orm";
import { and, eq } from "drizzle-orm";
import type { userRoles as userRolesSchema } from "../schema";

interface DrizzleDb {
  insert: (table: unknown) => {
    values: (data: unknown) => {
      onConflictDoNothing: () => Promise<unknown>;
    };
  };
  delete: (table: unknown) => {
    where: (condition: SQL<unknown>) => Promise<unknown>;
  };
  query: {
    userRoles: {
      findMany: (args: { where?: SQL<unknown> }) => Promise<unknown[]>;
    };
  };
}

interface UserRoleRow {
  id: string;
  userId: string;
  tenantId: string;
  role: string;
  createdAt: Date;
}

function assertUserRoleRow(row: unknown): row is UserRoleRow {
  if (!row || typeof row !== "object") {
    return false;
  }
  const record = row as Record<string, unknown>;
  return (
    typeof record.id === "string" &&
    typeof record.userId === "string" &&
    typeof record.tenantId === "string" &&
    typeof record.role === "string" &&
    record.createdAt instanceof Date
  );
}

/**
 * 테넌트별 사용자 역할을 Drizzle로 관리하는 레지스트리입니다.
 */
export class DrizzleRoleRegistry implements AbstractRoleRegistry {
  private readonly roleDefinitions: Map<string, RoleDefinition> = new Map();

  /**
   * Drizzle DB와 역할 스키마를 받아 레지스트리를 초기화합니다.
   */
  constructor(
    private readonly db: DrizzleDb,
    private readonly schema: { userRoles: typeof userRolesSchema },
  ) {}

  /**
   * 역할 정의를 메모리에 등록합니다.
   */
  registerRole(role: string, definition: RoleDefinition): void {
    this.roleDefinitions.set(role, definition);
  }

  /**
   * 등록된 역할 정의를 반환합니다.
   */
  getRoleDefinition(role: string): RoleDefinition | undefined {
    return this.roleDefinitions.get(role);
  }

  /**
   * 역할에 연결된 권한 목록을 반환합니다.
   */
  getRolePermissions(role: string): string[] {
    const definition = this.roleDefinitions.get(role);
    return definition?.permissions ?? [];
  }

  /**
   * 사용자와 테넌트에 할당된 역할 목록을 조회합니다.
   */
  async getUserRoles(userId: string, tenantId: string): Promise<string[]> {
    const rows = await this.db.query.userRoles.findMany({
      where: and(
        eq(this.schema.userRoles.userId, userId),
        eq(this.schema.userRoles.tenantId, tenantId),
      ),
    });

    const roles: string[] = [];
    for (const row of rows) {
      if (assertUserRoleRow(row)) {
        roles.push(row.role);
      }
    }

    return roles;
  }

  /**
   * 사용자에게 역할을 할당합니다.
   */
  async assignRole(userId: string, tenantId: string, role: string): Promise<void> {
    await this.db
      .insert(this.schema.userRoles)
      .values({
        userId,
        tenantId,
        role,
      })
      .onConflictDoNothing();
  }

  /**
   * 사용자에게서 역할을 회수합니다.
   */
  async revokeRole(userId: string, tenantId: string, role: string): Promise<void> {
    const condition = and(
      eq(this.schema.userRoles.userId, userId),
      eq(this.schema.userRoles.tenantId, tenantId),
      eq(this.schema.userRoles.role, role),
    );

    if (condition) {
      await this.db.delete(this.schema.userRoles).where(condition);
    }
  }

  /**
   * 역할에 연결된 권한 목록을 반환합니다.
   */
  getPermissionsForRole(role: string): string[] {
    const definition = this.roleDefinitions.get(role);
    return definition?.permissions ?? [];
  }
}
