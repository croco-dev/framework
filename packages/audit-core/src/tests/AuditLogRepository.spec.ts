import { describe, expect, it } from "vitest";
import { AuditLogRepository } from "../libs/AuditLogRepository";
import type { AuditLogEntry, AuditQuery } from "../libs/types";

class InMemoryAuditLogRepository extends AuditLogRepository {
  async create(entry: Omit<AuditLogEntry, "id" | "createdAt">): Promise<AuditLogEntry> {
    return {
      id: "audit-generated",
      createdAt: new Date(),
      ...entry,
    };
  }

  async find(query: AuditQuery): Promise<AuditLogEntry[]> {
    void query;
    return [];
  }
}

describe("AuditLogRepository", () => {
  it("should define AuditLogEntry with expected fields", () => {
    const entry: AuditLogEntry = {
      id: "audit-1",
      tenantId: "tenant-1",
      actorId: "user-1",
      action: "user.update",
      resourceType: "User",
      resourceId: "user-1",
      payload: { email: "user@example.com" },
      diff: { email: { before: "old@example.com", after: "user@example.com" } },
      metadata: { requestId: "req-1" },
      createdAt: new Date(),
    };

    expect(entry.id).toBe("audit-1");
    expect(entry.tenantId).toBe("tenant-1");
    expect(entry.actorId).toBe("user-1");
    expect(entry.action).toBe("user.update");
    expect(entry.resourceType).toBe("User");
    expect(entry.resourceId).toBe("user-1");
    expect(entry.payload).toEqual({ email: "user@example.com" });
    expect(entry.diff).toEqual({ email: { before: "old@example.com", after: "user@example.com" } });
    expect(entry.metadata).toEqual({ requestId: "req-1" });
    expect(entry.createdAt).toBeInstanceOf(Date);
  });

  it("should require create and find methods in abstract repository", () => {
    // @ts-expect-error - abstract class cannot be instantiated directly
    void new AuditLogRepository();

    // @ts-expect-error - abstract methods must be implemented
    class InvalidAuditLogRepository extends AuditLogRepository {}

    expect(InvalidAuditLogRepository).not.toBeUndefined();

    expect(typeof AuditLogRepository).toBe("function");
  });

  it("should allow concrete implementations to extend AuditLogRepository", async () => {
    const repository = new InMemoryAuditLogRepository();

    await expect(
      repository.create({
        tenantId: "tenant-1",
        actorId: "user-2",
        action: "project.create",
        resourceType: "Project",
        resourceId: "project-1",
        payload: { name: "croco" },
        diff: null,
        metadata: { source: "test" },
      }),
    ).resolves.toMatchObject({
      tenantId: "tenant-1",
      actorId: "user-2",
      action: "project.create",
      resourceType: "Project",
      resourceId: "project-1",
      payload: { name: "croco" },
      diff: null,
      metadata: { source: "test" },
    });

    await expect(repository.find({ tenantId: "tenant-1", limit: 20, offset: 0 })).resolves.toEqual(
      [],
    );
  });
});
