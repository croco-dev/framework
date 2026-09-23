import { createRlsPolicy } from "@croco/tx-drizzle";
import { Pool, type PoolClient } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

const connectionString = process.env.CUSTOMER_HEALTH_POSTGRES_URL ?? "";
const suffix = `${process.pid}_${Math.random().toString(36).slice(2, 8)}`;
const tableName = `croco_rls_${suffix}`;
const userRole = `croco_rls_user_${suffix}`;
const adminRole = `croco_rls_admin_${suffix}`;
const adminLogin = `croco_rls_admin_login_${suffix}`;
const rolePassword = "croco-rls-test-password";

function asRole(role: string): string {
  const url = new URL(connectionString);
  url.username = role;
  url.password = rolePassword;
  return url.toString();
}

describe.skipIf(connectionString.length === 0)("createRlsPolicy PostgreSQL isolation", () => {
  let owner!: Pool;
  let user!: Pool;
  let admin!: Pool;

  const installPolicy = async (adminRoles: string[] = []) => {
    await owner.query(createRlsPolicy({ tableName, tenantColumnType: "text", adminRoles }));
  };

  const withTransaction = async <T>(
    pool: Pool,
    tenantId: string | null,
    action: (client: PoolClient) => Promise<T>,
  ): Promise<T> => {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      if (tenantId !== null) {
        await client.query("SELECT set_config('app.current_tenant', $1, true)", [tenantId]);
      }
      const result = await action(client);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  };

  const rowsFor = (pool: Pool, tenantId: string | null) =>
    withTransaction(pool, tenantId, async (client) => {
      const result = await client.query<{ id: string; tenant_id: string }>(
        `SELECT id, tenant_id FROM "${tableName}" ORDER BY id`,
      );
      return result.rows;
    });

  beforeAll(async () => {
    owner = new Pool({ connectionString, max: 4 });
    await owner.query(`CREATE ROLE "${userRole}" LOGIN PASSWORD '${rolePassword}'`);
    await owner.query(`CREATE ROLE "${adminRole}" NOLOGIN`);
    await owner.query(`CREATE ROLE "${adminLogin}" LOGIN PASSWORD '${rolePassword}'`);
    await owner.query(`GRANT "${adminRole}" TO "${adminLogin}"`);
    await owner.query(
      `CREATE TABLE "${tableName}" (id text PRIMARY KEY, tenant_id text NOT NULL, value text NOT NULL)`,
    );
    await owner.query(
      `GRANT SELECT, INSERT, UPDATE, DELETE ON "${tableName}" TO "${userRole}", "${adminLogin}"`,
    );
    user = new Pool({ connectionString: asRole(userRole), max: 2 });
    admin = new Pool({ connectionString: asRole(adminLogin), max: 2 });
  });

  beforeEach(async () => {
    await owner.query(`TRUNCATE TABLE "${tableName}"`);
    await owner.query(`DROP POLICY IF EXISTS "${tableName}_tenant_isolation" ON "${tableName}"`);
    await owner.query(`DROP POLICY IF EXISTS "${tableName}_tenant_access" ON "${tableName}"`);
    await owner.query(`DROP POLICY IF EXISTS unrelated_broad_access ON "${tableName}"`);
    await owner.query(`ALTER TABLE "${tableName}" DISABLE ROW LEVEL SECURITY`);
    await installPolicy();
  });

  afterAll(async () => {
    await user?.end();
    await admin?.end();
    if (owner) {
      await owner.query(`DROP TABLE IF EXISTS "${tableName}"`);
      await owner.query(`DROP ROLE IF EXISTS "${adminLogin}"`);
      await owner.query(`DROP ROLE IF EXISTS "${adminRole}"`);
      await owner.query(`DROP ROLE IF EXISTS "${userRole}"`);
      await owner.end();
    }
  });

  it("allows a non-owner to select, insert, update, and delete only matching tenant rows", async () => {
    await withTransaction(user, "tenant-a", async (client) => {
      await client.query(`INSERT INTO "${tableName}" VALUES ('a', 'tenant-a', 'first')`);
      const selected = await client.query<{ value: string }>(
        `SELECT value FROM "${tableName}" WHERE id = 'a'`,
      );
      expect(selected.rows).toEqual([{ value: "first" }]);
      const updated = await client.query(
        `UPDATE "${tableName}" SET value = 'second' WHERE id = 'a'`,
      );
      expect(updated.rowCount).toBe(1);
    });

    expect(await rowsFor(user, "tenant-b")).toEqual([]);
    expect(await rowsFor(user, "tenant-a")).toEqual([{ id: "a", tenant_id: "tenant-a" }]);

    await withTransaction(user, "tenant-a", async (client) => {
      const deleted = await client.query(`DELETE FROM "${tableName}" WHERE id = 'a'`);
      expect(deleted.rowCount).toBe(1);
    });
    expect(await rowsFor(user, "tenant-a")).toEqual([]);
  });

  it("enforces tenant isolation with the default UUID column contract", async () => {
    const uuidTableName = `${tableName}_uuid`;
    const tenantA = "00000000-0000-4000-8000-000000000001";
    const tenantB = "00000000-0000-4000-8000-000000000002";
    await owner.query(
      `CREATE TABLE "${uuidTableName}" (id text PRIMARY KEY, tenant_id uuid NOT NULL)`,
    );
    try {
      await owner.query(
        `GRANT SELECT, INSERT, UPDATE, DELETE ON "${uuidTableName}" TO "${userRole}"`,
      );
      await owner.query(createRlsPolicy({ tableName: uuidTableName }));
      await withTransaction(user, tenantA, (client) =>
        client.query(`INSERT INTO "${uuidTableName}" VALUES ('a', '${tenantA}')`),
      );
      const matching = await withTransaction(user, tenantA, (client) =>
        client.query<{ id: string }>(`SELECT id FROM "${uuidTableName}"`),
      );
      const other = await withTransaction(user, tenantB, (client) =>
        client.query<{ id: string }>(`SELECT id FROM "${uuidTableName}"`),
      );
      expect(matching.rows).toEqual([{ id: "a" }]);
      expect(other.rows).toEqual([]);
    } finally {
      await owner.query(`DROP TABLE "${uuidTableName}"`);
    }
  });

  it("rejects cross-tenant inserts and tenant reassignment while hiding cross-tenant updates and deletes", async () => {
    await withTransaction(user, "tenant-a", async (client) => {
      await client.query(`INSERT INTO "${tableName}" VALUES ('a', 'tenant-a', 'first')`);
    });

    await expect(
      withTransaction(user, "tenant-b", (client) =>
        client.query(`INSERT INTO "${tableName}" VALUES ('bad', 'tenant-a', 'foreign')`),
      ),
    ).rejects.toMatchObject({ code: "42501" });
    await expect(
      withTransaction(user, "tenant-a", (client) =>
        client.query(`UPDATE "${tableName}" SET tenant_id = 'tenant-b' WHERE id = 'a'`),
      ),
    ).rejects.toMatchObject({ code: "42501" });

    await withTransaction(user, "tenant-b", async (client) => {
      expect(
        (await client.query(`UPDATE "${tableName}" SET value = 'foreign' WHERE id = 'a'`)).rowCount,
      ).toBe(0);
      expect((await client.query(`DELETE FROM "${tableName}" WHERE id = 'a'`)).rowCount).toBe(0);
    });
    expect(await rowsFor(user, "tenant-a")).toEqual([{ id: "a", tenant_id: "tenant-a" }]);
  });

  it("fails closed without tenant context, including after a previous tenant transaction", async () => {
    await withTransaction(user, "tenant-a", (client) =>
      client.query(`INSERT INTO "${tableName}" VALUES ('a', 'tenant-a', 'first')`),
    );

    expect(await rowsFor(user, null)).toEqual([]);
    await expect(
      withTransaction(user, null, (client) =>
        client.query(`INSERT INTO "${tableName}" VALUES ('missing', 'tenant-a', 'bad')`),
      ),
    ).rejects.toMatchObject({ code: "42501" });
  });

  it("retains the tenant guard alongside an unrelated broad permissive policy", async () => {
    await owner.query(
      `CREATE POLICY unrelated_broad_access ON "${tableName}" AS PERMISSIVE FOR ALL USING (true) WITH CHECK (true)`,
    );
    await withTransaction(user, "tenant-a", (client) =>
      client.query(`INSERT INTO "${tableName}" VALUES ('a', 'tenant-a', 'first')`),
    );

    expect(await rowsFor(user, "tenant-b")).toEqual([]);
    await expect(
      withTransaction(user, "tenant-b", (client) =>
        client.query(`INSERT INTO "${tableName}" VALUES ('bad', 'tenant-a', 'foreign')`),
      ),
    ).rejects.toMatchObject({ code: "42501" });
  });

  it("rejects an application-owned access-policy collision without changing policies or visibility", async () => {
    await owner.query(`DROP POLICY "${tableName}_tenant_access" ON "${tableName}"`);
    await owner.query(
      `CREATE POLICY "${tableName}_tenant_access" ON "${tableName}" AS PERMISSIVE FOR ALL USING (true) WITH CHECK (true)`,
    );
    await owner.query(`INSERT INTO "${tableName}" VALUES ('a', 'tenant-a', 'existing')`);
    const policiesBefore = await owner.query(
      `SELECT policyname, permissive, roles, cmd, qual, with_check FROM pg_policies WHERE schemaname = current_schema() AND tablename = $1 ORDER BY policyname`,
      [tableName],
    );
    const visibleBefore = await rowsFor(user, "tenant-a");
    const hiddenBefore = await rowsFor(user, "tenant-b");

    await expect(installPolicy()).rejects.toThrow();

    const policiesAfter = await owner.query(
      `SELECT policyname, permissive, roles, cmd, qual, with_check FROM pg_policies WHERE schemaname = current_schema() AND tablename = $1 ORDER BY policyname`,
      [tableName],
    );
    expect(policiesAfter.rows).toEqual(policiesBefore.rows);
    expect(await rowsFor(user, "tenant-a")).toEqual(visibleBefore);
    expect(await rowsFor(user, "tenant-b")).toEqual(hiddenBefore);
    expect(visibleBefore).toEqual([{ id: "a", tenant_id: "tenant-a" }]);
    expect(hiddenBefore).toEqual([]);
  });

  it("installs policies when the table identifier contains the PL/pgSQL delimiter", async () => {
    const delimiterTableName = `rls$croco_rls$_${suffix}`;
    await owner.query(
      `CREATE TABLE "${delimiterTableName}" (id text PRIMARY KEY, tenant_id text NOT NULL)`,
    );
    try {
      await owner.query(
        `GRANT SELECT, INSERT, UPDATE, DELETE ON "${delimiterTableName}" TO "${userRole}"`,
      );
      await owner.query(
        createRlsPolicy({ tableName: delimiterTableName, tenantColumnType: "text" }),
      );
      await withTransaction(user, "tenant-a", (client) =>
        client.query(`INSERT INTO "${delimiterTableName}" VALUES ('a', 'tenant-a')`),
      );
      const matching = await withTransaction(user, "tenant-a", (client) =>
        client.query<{ id: string }>(`SELECT id FROM "${delimiterTableName}"`),
      );
      const other = await withTransaction(user, "tenant-b", (client) =>
        client.query<{ id: string }>(`SELECT id FROM "${delimiterTableName}"`),
      );
      expect(matching.rows).toEqual([{ id: "a" }]);
      expect(other.rows).toEqual([]);
    } finally {
      await owner.query(`DROP TABLE "${delimiterTableName}"`);
    }
  });

  it("allows only a declared admin role to cross tenant boundaries without tenant context", async () => {
    await expect(
      withTransaction(admin, null, (client) =>
        client.query(`INSERT INTO "${tableName}" VALUES ('before-admin', 'tenant-a', 'blocked')`),
      ),
    ).rejects.toMatchObject({ code: "42501" });
    await installPolicy([adminRole]);
    await withTransaction(user, "tenant-a", (client) =>
      client.query(`INSERT INTO "${tableName}" VALUES ('a', 'tenant-a', 'first')`),
    );

    expect(await rowsFor(admin, null)).toEqual([{ id: "a", tenant_id: "tenant-a" }]);
    await withTransaction(admin, null, async (client) => {
      await client.query(`INSERT INTO "${tableName}" VALUES ('b', 'tenant-b', 'admin')`);
      expect((await client.query(`DELETE FROM "${tableName}" WHERE id = 'a'`)).rowCount).toBe(1);
    });
    expect(await rowsFor(user, null)).toEqual([]);
    expect(await rowsFor(user, "tenant-b")).toEqual([{ id: "b", tenant_id: "tenant-b" }]);
  });

  it("upgrades a restrictive-only installation and replays without duplicate or unrelated-policy changes", async () => {
    await owner.query(`DROP POLICY "${tableName}_tenant_access" ON "${tableName}"`);
    const restrictiveOnly = await owner.query<{ policyname: string; permissive: string }>(
      `SELECT policyname, permissive FROM pg_policies WHERE schemaname = current_schema() AND tablename = $1`,
      [tableName],
    );
    expect(restrictiveOnly.rows).toEqual([
      { policyname: `${tableName}_tenant_isolation`, permissive: "RESTRICTIVE" },
    ]);
    await expect(
      withTransaction(user, "tenant-a", (client) =>
        client.query(`INSERT INTO "${tableName}" VALUES ('before-upgrade', 'tenant-a', 'blocked')`),
      ),
    ).rejects.toMatchObject({ code: "42501" });
    await owner.query(
      `CREATE POLICY unrelated_broad_access ON "${tableName}" AS PERMISSIVE FOR SELECT USING (true)`,
    );
    await installPolicy();
    await installPolicy();

    const policies = await owner.query<{ policyname: string; permissive: string }>(
      `SELECT policyname, permissive FROM pg_policies WHERE schemaname = current_schema() AND tablename = $1 ORDER BY policyname`,
      [tableName],
    );
    expect(policies.rows).toEqual(
      [
        { policyname: `${tableName}_tenant_access`, permissive: "PERMISSIVE" },
        { policyname: `${tableName}_tenant_isolation`, permissive: "RESTRICTIVE" },
        { policyname: "unrelated_broad_access", permissive: "PERMISSIVE" },
      ].sort((a, b) => a.policyname.localeCompare(b.policyname)),
    );

    await withTransaction(user, "tenant-a", (client) =>
      client.query(`INSERT INTO "${tableName}" VALUES ('a', 'tenant-a', 'first')`),
    );
    expect(await rowsFor(user, "tenant-b")).toEqual([]);
  });

  it("rolls back tenant writes and does not leak transaction-local tenant context", async () => {
    const rollback = new Error("rollback tenant write");
    await expect(
      withTransaction(user, "tenant-a", async (client) => {
        await client.query(`INSERT INTO "${tableName}" VALUES ('a', 'tenant-a', 'first')`);
        expect((await client.query(`SELECT id FROM "${tableName}"`)).rows).toEqual([{ id: "a" }]);
        throw rollback;
      }),
    ).rejects.toBe(rollback);
    expect(await rowsFor(user, "tenant-a")).toEqual([]);
    expect(await rowsFor(user, null)).toEqual([]);
  });
});
