import { verifyToken } from "@clerk/backend";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ClerkAuthProvider } from "../libs/ClerkAuthProvider";
import { ClerkTenantMapper } from "../libs/ClerkTenantMapper";
import {
  ClerkMalformedClaimProblem,
  ClerkTokenVerificationProblem,
} from "../libs/problems/ClerkProblems";
import type { AuthorizationHeaderCarrier } from "../libs/types";

type VerifiedToken = Awaited<ReturnType<typeof verifyToken>>;

vi.mock("@clerk/backend", () => ({
  createClerkClient: vi.fn(),
  verifyToken: vi.fn(),
}));

describe("ClerkAuthProvider", () => {
  let authProvider!: ClerkAuthProvider;
  const options = { secretKey: "sk_test_123", publishableKey: "pk_test_123" };

  beforeEach(() => {
    vi.clearAllMocks();
    authProvider = new ClerkAuthProvider(options);
  });

  const createRequest = (authHeader?: string): AuthorizationHeaderCarrier => {
    const headers = new Headers();
    if (authHeader) {
      headers.set("Authorization", authHeader);
    }
    return {
      headers,
    };
  };

  it("should return null if Authorization header is missing", async () => {
    const request = createRequest();
    const result = await authProvider.authenticate(request);
    expect(result).toBeNull();
  });

  it("should return null if Authorization header is not Bearer", async () => {
    const request = createRequest("Basic token");
    const result = await authProvider.authenticate(request);
    expect(result).toBeNull();
  });

  it("should throw a problem if token verification fails", async () => {
    const request = createRequest("Bearer invalid-token");
    vi.mocked(verifyToken).mockRejectedValue(new Error("Invalid token"));

    await expect(authProvider.authenticate(request)).rejects.toBeInstanceOf(
      ClerkTokenVerificationProblem,
    );
  });

  it("should return AuthUser on successful verification", async () => {
    const request = createRequest("Bearer valid-token");
    const mockVerifiedToken = {
      sub: "user_123",
      email: "test@example.com",
      org_id: "org_123",
      org_role: "admin",
      org_permissions: ["perm:read", "perm:write"],
      org_slug: "my-org",
      sid: "sess_123",
    };

    vi.mocked(verifyToken).mockResolvedValue(mockVerifiedToken as unknown as VerifiedToken);

    const result = await authProvider.authenticate(request);

    expect(result).toEqual({
      id: "user_123",
      email: "test@example.com",
      roles: ["admin"],
      permissions: ["perm:read", "perm:write"],
      metadata: {
        clerkUserId: "user_123",
        orgId: "org_123",
        orgRole: "admin",
        orgSlug: "my-org",
        sessionId: "sess_123",
      },
    });

    expect(verifyToken).toHaveBeenCalledWith("valid-token", { secretKey: options.secretKey });
  });

  it("should fail when org_permissions contains non-string values", async () => {
    const request = createRequest("Bearer valid-token");
    const mockVerifiedToken = {
      sub: "user_123",
      org_role: "admin",
      org_permissions: ["perm:read", 123],
    };

    vi.mocked(verifyToken).mockResolvedValue(mockVerifiedToken as unknown as VerifiedToken);

    await expect(authProvider.authenticate(request)).rejects.toBeInstanceOf(
      ClerkMalformedClaimProblem,
    );
  });

  it("should fail when verified token subject is missing", async () => {
    const request = createRequest("Bearer valid-token");
    const mockVerifiedToken = {
      email: "test@example.com",
      org_permissions: ["perm:read"],
    };

    vi.mocked(verifyToken).mockResolvedValue(mockVerifiedToken as unknown as VerifiedToken);

    await expect(authProvider.authenticate(request)).rejects.toBeInstanceOf(
      ClerkMalformedClaimProblem,
    );
  });

  it("should fail when org_permissions claim is not an array", async () => {
    const request = createRequest("Bearer valid-token");
    const mockVerifiedToken = {
      sub: "user_123",
      org_permissions: "perm:read",
    };

    vi.mocked(verifyToken).mockResolvedValue(mockVerifiedToken as unknown as VerifiedToken);

    await expect(authProvider.authenticate(request)).rejects.toBeInstanceOf(
      ClerkMalformedClaimProblem,
    );
  });

  it("should handle missing optional fields correctly", async () => {
    const request = createRequest("Bearer valid-token");
    const mockVerifiedToken = {
      sub: "user_123",
      // Missing email, org info
    };

    vi.mocked(verifyToken).mockResolvedValue(mockVerifiedToken as unknown as VerifiedToken);

    const result = await authProvider.authenticate(request);

    expect(result).toEqual({
      id: "user_123",
      email: undefined,
      roles: [],
      permissions: [],
      metadata: {
        clerkUserId: "user_123",
        orgId: undefined,
        orgRole: undefined,
        orgSlug: undefined,
        sessionId: undefined,
      },
    });
  });
});

describe("ClerkAuthProvider session token v2 organization claims", () => {
  const options = { secretKey: "sk_test_123" };
  const request = { headers: new Headers({ Authorization: "Bearer v2-token" }) };
  const organization = {
    id: "org_123",
    rol: "admin",
    slg: "my-org",
    per: "read,manage",
    fpm: "3",
  };
  const payload = {
    v: 2,
    sub: "user_123",
    sid: "sess_123",
    fea: "o:dashboard",
    o: organization,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  function authenticate(claims: Record<string, unknown> = payload) {
    vi.mocked(verifyToken).mockResolvedValue(claims as unknown as VerifiedToken);
    return new ClerkAuthProvider(options).authenticate(request);
  }

  it("maps the active organization from a v2 token", async () => {
    const user = await authenticate();

    expect(user).toEqual({
      id: "user_123",
      email: undefined,
      roles: ["org:admin"],
      permissions: ["org:dashboard:read", "org:dashboard:manage"],
      metadata: {
        clerkUserId: "user_123",
        orgId: "org_123",
        orgRole: "org:admin",
        orgSlug: "my-org",
        sessionId: "sess_123",
      },
    });
  });

  it("resolves the mapped tenant for a v2 token", async () => {
    const mapper = new ClerkTenantMapper();
    await mapper.register("org_123", "tenant-1");
    const user = await authenticate();

    expect(await mapper.resolve({ user: user ?? undefined })).toBe("tenant-1");
  });

  it("authenticates a v2 token without an active organization", async () => {
    const user = await authenticate({ v: 2, sub: "user_123", sid: "sess_123" });

    expect(user).toMatchObject({ roles: [], permissions: [], metadata: { orgId: undefined } });
    expect(await new ClerkTenantMapper().resolve({ user: user ?? undefined })).toBeNull();
  });

  it("uses v2 organization claims when legacy organization claims are also present", async () => {
    const user = await authenticate({
      ...payload,
      org_id: "org_legacy",
      org_role: "legacy",
      org_slug: "legacy",
      org_permissions: ["legacy:read"],
    });

    expect(user).toMatchObject({
      roles: ["org:admin"],
      permissions: ["org:dashboard:read", "org:dashboard:manage"],
      metadata: { orgId: "org_123", orgRole: "org:admin", orgSlug: "my-org" },
    });
  });

  it.each([null, "org_123", 123, [], {}])("rejects malformed organization %j", async (o) => {
    await expect(authenticate({ ...payload, o })).rejects.toThrow(
      new ClerkMalformedClaimProblem("o"),
    );
  });

  it.each(["id", "slg", "rol", "per", "fpm"])(
    "rejects a missing or non-string organization %s field",
    async (field) => {
      for (const value of [undefined, null, 123, ["admin"]]) {
        await expect(
          authenticate({ ...payload, o: { ...organization, [field]: value } }),
        ).rejects.toThrow(new ClerkMalformedClaimProblem("o"));
      }
    },
  );

  it.each([null, 123, ["o:dashboard"], {}])("rejects malformed features %j", async (fea) => {
    await expect(authenticate({ ...payload, fea })).rejects.toThrow(
      new ClerkMalformedClaimProblem("fea"),
    );
  });

  it.each(["-1", "1.5", "1x", "NaN", "Infinity", " ", "9007199254740992"])(
    "rejects invalid or unsafe permission bitmap %s",
    async (fpm) => {
      await expect(authenticate({ ...payload, o: { ...organization, fpm } })).rejects.toThrow(
        new ClerkMalformedClaimProblem("o"),
      );
    },
  );

  it.each([
    {
      name: "combined organization and user scope without shifting feature bitmaps",
      fea: "ou:dashboard,o:billing",
      per: "read,manage",
      fpm: "1,2",
      expected: ["org:dashboard:read", "org:billing:manage"],
    },
    {
      name: "organization feature order across interleaved user features",
      fea: "o:dashboard,u:profile,o:teams",
      per: "manage,read",
      fpm: "3,2",
      expected: ["org:dashboard:manage", "org:dashboard:read", "org:teams:read"],
    },
    {
      name: "organization scopes with user-only features excluded",
      fea: "u:profile, o:dashboard, o:billing",
      per: "read, manage",
      fpm: "1, 2",
      expected: ["org:dashboard:read", "org:billing:manage"],
    },
    {
      name: "zero permission bits",
      fea: "o:dashboard",
      per: "read,manage",
      fpm: "0",
      expected: [],
    },
    {
      name: "features without matching bitmap entries",
      fea: "o:dashboard,o:billing",
      per: "read,manage",
      fpm: "1",
      expected: ["org:dashboard:read"],
    },
    {
      name: "bitmap entries without matching features",
      fea: "o:dashboard",
      per: "read,manage",
      fpm: "2,3",
      expected: ["org:dashboard:manage"],
    },
    { name: "empty permissions", fea: "o:dashboard", per: "", fpm: "", expected: [] },
    { name: "empty features", fea: "", per: "read", fpm: "1", expected: [] },
  ])("decodes $name", async ({ fea, per, fpm, expected }) => {
    const user = await authenticate({ ...payload, fea, o: { ...organization, per, fpm } });

    expect(user?.permissions).toEqual(expected);
  });
});
