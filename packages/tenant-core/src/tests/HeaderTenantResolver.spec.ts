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

  it.each(["x-tenant-id", "X-Tenant-ID", "X-TENANT-ID"])(
    "should resolve the default header with incoming name %s",
    async (headerName) => {
      expect(
        await new HeaderTenantResolver().resolve({ headers: { [headerName]: "Tenant-A7" } }),
      ).toBe("Tenant-A7");
    },
  );

  describe.each(["x-org-id", "X-Org-ID", "X-ORG-ID"])("configured header %s", (headerName) => {
    it.each(["x-org-id", "X-Org-ID", "X-ORG-ID"])(
      "should resolve incoming name %s",
      async (incomingName) => {
        const resolver = new HeaderTenantResolver({ headerName });
        expect(await resolver.resolve({ headers: { [incomingName]: "org-456" } })).toBe("org-456");
      },
    );
  });

  it("should preserve array selection and leave the original header bag unchanged", async () => {
    const values = ["tenant-1", "tenant-2"];
    Object.freeze(values);
    const headers = Object.freeze({ "X-Tenant-ID": values, "x-other": "unrelated" });

    expect(await new HeaderTenantResolver().resolve({ headers })).toBe("tenant-1");
    expect(headers).toEqual({ "X-Tenant-ID": ["tenant-1", "tenant-2"], "x-other": "unrelated" });
    expect(headers["X-Tenant-ID"]).toBe(values);
  });

  it.each([undefined, "", []])(
    "should preserve missing or empty value handling for %j",
    async (value) => {
      expect(
        await new HeaderTenantResolver().resolve({ headers: { "X-Tenant-ID": value } }),
      ).toBeNull();
    },
  );

  it.each([
    { "x-tenant-id": "tenant-1", "X-Tenant-ID": "tenant-2" },
    { "X-Tenant-ID": "tenant-2", "x-tenant-id": "tenant-1" },
    { "x-tenant-id": "tenant-1", "X-Tenant-ID": "tenant-1" },
    { "x-tenant-id": undefined, "X-Tenant-ID": "tenant-2" },
  ])("should return null for duplicate case-insensitive keys %j", async (headers) => {
    expect(await new HeaderTenantResolver().resolve({ headers })).toBeNull();
  });

  it("should ignore inherited tenant headers while accepting own headers", async () => {
    const headers: Record<string, string> = Object.create({ "x-tenant-id": "inherited-tenant" });
    const resolver = new HeaderTenantResolver();
    expect(await resolver.resolve({ headers })).toBeNull();

    headers["X-Tenant-ID"] = "own-tenant";
    expect(await resolver.resolve({ headers })).toBe("own-tenant");
  });

  it.each([
    ["x-tenant-id", "X-Tenant-ID"],
    ["X-Tenant-ID", "x-tenant-id"],
  ])("should resolve a non-enumerable own header %s", async (headerName, duplicateName) => {
    const headers: Record<string, string> = {};
    Object.defineProperty(headers, headerName, { value: "own-tenant", enumerable: false });
    expect(await new HeaderTenantResolver().resolve({ headers })).toBe("own-tenant");

    headers[duplicateName] = "another-tenant";
    expect(await new HeaderTenantResolver().resolve({ headers })).toBeNull();
  });

  it("should not resolve an inherited Object prototype property as a custom header", async () => {
    const resolver = new HeaderTenantResolver({ headerName: "constructor" });
    expect(await resolver.resolve({ headers: {} })).toBeNull();
    expect(await resolver.resolve({ headers: { constructor: "own-tenant" } })).toBe("own-tenant");
  });
});
