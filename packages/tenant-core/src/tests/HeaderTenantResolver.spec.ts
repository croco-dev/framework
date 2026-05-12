import { describe, expect, it } from "vitest";
import { HeaderTenantResolver } from "../libs/resolvers/HeaderTenantResolver";

describe("HeaderTenantResolver", () => {
  it("should resolve tenant from header", async () => {
    const resolver = new HeaderTenantResolver({ headerName: "x-tenant-id" });
    const result = await resolver.resolve({ headers: { "x-tenant-id": "tenant-123" } });
    expect(result).toBe("tenant-123");
  });

  it("should resolve from first value when header is array", async () => {
    const resolver = new HeaderTenantResolver({ headerName: "x-tenant-id" });
    const result = await resolver.resolve({ headers: { "x-tenant-id": ["tenant-1", "tenant-2"] } });
    expect(result).toBe("tenant-1");
  });

  it("should return null when header is missing", async () => {
    const resolver = new HeaderTenantResolver({ headerName: "x-tenant-id" });
    const result = await resolver.resolve({ headers: {} });
    expect(result).toBeNull();
  });

  it("should return null when headers is undefined", async () => {
    const resolver = new HeaderTenantResolver({ headerName: "x-tenant-id" });
    const result = await resolver.resolve({});
    expect(result).toBeNull();
  });

  it("should use custom header name", async () => {
    const resolver = new HeaderTenantResolver({ headerName: "x-org-id" });
    const result = await resolver.resolve({ headers: { "x-org-id": "org-123" } });
    expect(result).toBe("org-123");
  });

  it("should use default header name", async () => {
    const resolver = new HeaderTenantResolver();
    const result = await resolver.resolve({ headers: { "x-tenant-id": "default-tenant" } });
    expect(result).toBe("default-tenant");
  });
});
