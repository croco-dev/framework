import { beforeEach, describe, expect, it } from "vitest";
import { resetAdminRuntimeForTests } from "../admin";
import { createCrocoApp } from "../app";

describe("Admin console API", () => {
  beforeEach(() => {
    resetAdminRuntimeForTests();
  });

  it("serves tenant-scoped resource table data", async () => {
    const app = createCrocoApp();
    const response = await app.fetch(
      new Request("http://localhost/admin/users?tenantId=tenant_acme"),
    );
    const users = (await response.json()) as Array<{ id: string; tenantId: string }>;

    expect(response.status).toBe(200);
    expect(users).toHaveLength(2);
    expect(users.every((user) => user.tenantId === "tenant_acme")).toBe(true);
  });

  it("creates an invited admin user and records the operation", async () => {
    const app = createCrocoApp();
    const createResponse = await app.fetch(
      new Request("http://localhost/admin/users", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          tenantId: "tenant_acme",
          name: "Dorothy Vaughan",
          email: "dorothy@example.com",
          role: "admin",
        }),
      }),
    );
    const created = (await createResponse.json()) as { id: string; status: string };
    const operationsResponse = await app.fetch(
      new Request("http://localhost/admin/operations?tenantId=tenant_acme"),
    );
    const operations = (await operationsResponse.json()) as Array<{
      action: string;
      summary: string;
    }>;

    expect(createResponse.status).toBe(200);
    expect(created.status).toBe("invited");
    expect(operations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          action: "user.invited",
          summary: expect.stringContaining("dorothy@example.com"),
        }),
      ]),
    );
  });

  it("returns declared Problem details for a missing admin user", async () => {
    const app = createCrocoApp();
    const response = await app.fetch(new Request("http://localhost/admin/users/missing"));
    const problem = await response.json();

    expect(response.status).toBe(404);
    expect(problem).toEqual(
      expect.objectContaining({
        status: 404,
        code: "admin-console/user-not-found",
      }),
    );
  });

  it("records missing user lookups in the selected tenant timeline", async () => {
    const app = createCrocoApp();
    const response = await app.fetch(
      new Request("http://localhost/admin/users/missing?tenantId=tenant_globex"),
    );
    const operationsResponse = await app.fetch(
      new Request("http://localhost/admin/operations?tenantId=tenant_globex"),
    );
    const operations = (await operationsResponse.json()) as Array<{
      action: string;
      tenantId: string;
    }>;

    expect(response.status).toBe(404);
    expect(operations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          action: "user.lookup_failed",
          tenantId: "tenant_globex",
        }),
      ]),
    );
  });
});
