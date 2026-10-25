import { resolve } from "node:path";
import { generateKeyPairSync, sign } from "node:crypto";
import { build } from "esbuild";
import { Miniflare } from "miniflare";
import type { Request as MiniflareRequest } from "miniflare";
import { describe, expect, it } from "vitest";

const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const jwtKey = publicKey.export({ type: "spki", format: "pem" }).toString();
const secretKey = "sk_test_worker_synthetic_secret";
const origin = "https://console.example.com";
function mint(overrides: Record<string, unknown> = {}, invalidSignature = false) {
  const now = Math.floor(Date.now() / 1000);
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const body = `${encode({ alg: "RS256", typ: "JWT", kid: "fixture-key" })}.${encode({
    sub: "user_abc",
    sid: "sess_active",
    iss: "https://fixture.clerk.accounts.dev",
    azp: origin,
    aud: "croco-api",
    iat: now,
    nbf: now - 10,
    exp: now + 60,
    org_id: "org_alpha",
    org_role: "org:admin",
    org_permissions: ["billing:read"],
    ...overrides,
  })}`;
  const signature = sign("RSA-SHA256", Buffer.from(body), privateKey);
  if (invalidSignature) signature[0] ^= 1;
  return `${body}.${signature.toString("base64url")}`;
}

const bundled = await build({
  stdin: {
    resolveDir: import.meta.dirname,
    sourcefile: "worker-fixture.ts",
    contents: `
    import { ClerkWorkersAuthProvider, ClerkSessionProvider, ClerkTenantMapper, clerkWorkersAuth } from '../workers';
    import { AUTH_PROVIDER_TOKEN } from '@croco/auth-core';
    import { createApplicationRuntime, defineCrocoApplication } from '@croco/framework-module';
    import { ClerkAuthDiagnosticsProvider } from '../libs/ClerkAuthDiagnosticsProvider';
    let runtimeReady;
    async function getRuntime(options) {
      if (!runtimeReady) {
        const runtime = createApplicationRuntime(defineCrocoApplication({ name: 'worker-auth', imports: [clerkWorkersAuth(options)] }));
        runtimeReady = runtime.initialize().then(() => runtime);
      }
      return runtimeReady;
    }
    export default { async fetch(request, env) {
      try {
        if (new URL(request.url).pathname === '/health') {
          return Response.json(await new ClerkAuthDiagnosticsProvider({ secretKey: '' }).getHealth());
        }
        const mapper = new ClerkTenantMapper({ get: async (org) => ({ org_alpha: 'tenant_a', org_beta: 'tenant_b' })[org] ?? null });
        const options = { secretKey: env.CLERK_SECRET_KEY, jwtKey: new URL(request.url).pathname === '/remote-key' ? undefined : env.CLERK_JWT_KEY,
          audience: 'croco-api', authorizedParties: ['${origin}'], tenantMapping: mapper,
          resolveTargetTenant: async (request) => new URL(request.url).searchParams.get('tenant') };
        if (new URL(request.url).pathname === '/config') { new ClerkWorkersAuthProvider({ ...options, audience: '' }); }
        if (new URL(request.url).pathname === '/graph') {
          const plugin = clerkWorkersAuth(options);
          return Response.json(plugin.metadata);
        }
        if (new URL(request.url).pathname === '/revoke') {
          await new ClerkSessionProvider(options).revokeSession('sess_active');
          return new Response(null, { status: 204 });
        }
        const runtime = await getRuntime(options);
        const user = await runtime.bindHostCallback(() => runtime.get(AUTH_PROVIDER_TOKEN).authenticate(request))();
        return Response.json(user, { status: user ? 200 : 401 });
      } catch (error) { if (!error.toJSON) throw error; return Response.json(error.toJSON(), { status: error.status }); }
    } };
  `,
  },
  bundle: true,
  write: false,
  format: "esm",
  platform: "neutral",
  mainFields: ["module", "main"],
  conditions: ["worker", "browser"],
  external: ["node:*"],
  metafile: true,
  alias: Object.fromEntries(
    [
      "auth-core",
      "problems-core",
      "framework-context",
      "framework-module",
      "diagnostics-core",
      "tenant-core",
      "telemetry-api",
      "events-core",
    ].map((name) => [
      `@croco/${name}`,
      resolve(import.meta.dirname, `../../../${name}/src/index.ts`),
    ]),
  ),
});

async function fixture(
  run: (mf: Miniflare) => Promise<void>,
  upstreamStatus = 200,
  userId = "user_abc",
  expireAt = Date.now() + 60000,
) {
  let revoked = false;
  const mf = new Miniflare({
    modules: true,
    script: bundled.outputFiles[0].text,
    compatibilityDate: "2026-03-12",
    compatibilityFlags: ["nodejs_compat"],
    bindings: { CLERK_JWT_KEY: jwtKey, CLERK_SECRET_KEY: secretKey },
    outboundService: async (request: MiniflareRequest) => {
      const url = new URL(request.url);
      if (request.headers.get("Authorization") !== `Bearer ${secretKey}`) {
        return new Response("Missing secret binding", { status: 401 });
      }
      if (url.hostname === "api.clerk.com" && url.pathname === "/v1/jwks") {
        return Response.json({
          keys: [
            {
              ...publicKey.export({ format: "jwk" }),
              kid: "fixture-key",
              alg: "RS256",
              use: "sig",
            },
          ],
        });
      }
      if (
        url.hostname !== "api.clerk.com" ||
        !url.pathname.startsWith("/v1/sessions/sess_active")
      ) {
        return new Response("Unexpected upstream request", { status: 500 });
      }
      if (request.method === "POST" && url.pathname.endsWith("/revoke")) revoked = true;
      return Response.json(
        upstreamStatus === 200
          ? {
              object: "session",
              id: "sess_active",
              user_id: userId,
              status: revoked ? "revoked" : "active",
              expire_at: expireAt,
              created_at: 1700000000000,
              updated_at: 1700000001000,
            }
          : { errors: [{ message: secretKey, code: "fixture_error" }] },
        { status: upstreamStatus },
      );
    },
  });
  try {
    await run(mf);
  } finally {
    await mf.dispose();
  }
}
const url = "https://api.example.com/auth?tenant=tenant_a";

describe("Clerk Workers authentication subset (actual workerd, synthetic upstream)", () => {
  it("bundles the SDK Web Crypto implementation under worker conditions", () => {
    const inputs = Object.keys(bundled.metafile.inputs);
    expect(inputs.some((path) => path.includes("runtime/browser/crypto"))).toBe(true);
    expect(inputs.some((path) => path.includes("runtime/node/crypto"))).toBe(false);
  });
  it.each(["bearer", "cookie"])(
    "authenticates a signed %s and resolves server tenant/permissions",
    async (carrier) => {
      await fixture(async (mf) => {
        const token = mint();
        const response = await mf.dispatchFetch(url, {
          headers:
            carrier === "bearer"
              ? { Authorization: `Bearer ${token}` }
              : { Cookie: `__session=${token}` },
        });
        expect(response.status, await response.clone().text()).toBe(200);
        expect(await response.json()).toMatchObject({
          id: "user_abc",
          tenantId: "tenant_a",
          roles: ["org:admin"],
          permissions: ["billing:read"],
          metadata: { sessionId: "sess_active", orgId: "org_alpha" },
        });
      });
    },
  );
  it("verifies through the SDK remote JWKS fetch path when no local public key is bound", async () => {
    await fixture(async (mf) => {
      const response = await mf.dispatchFetch(url.replace("/auth?", "/remote-key?"), {
        headers: { Authorization: `Bearer ${mint()}` },
      });
      expect(response.status, await response.clone().text()).toBe(200);
    });
  });
  it("accepts allowed-origin cookie writes and rejects ambiguous session cookies", async () => {
    await fixture(async (mf) => {
      const token = mint();
      expect(
        (
          await mf.dispatchFetch(url, {
            method: "POST",
            headers: { Cookie: `__session=${token}`, Origin: origin },
          })
        ).status,
      ).toBe(200);
      expect(
        (
          await mf.dispatchFetch(url, {
            headers: { Cookie: `__session=${token}; __session=${mint({ org_id: "org_beta" })}` },
          })
        ).status,
      ).toBe(401);
    });
  });
  it("maps signed v2 organization roles and permission bits through the shared auth contract", async () => {
    await fixture(async (mf) => {
      const token = mint({
        v: 2,
        fea: "o:billing",
        o: { id: "org_beta", rol: "member", slg: "beta", per: "read,write", fpm: "2" },
      });
      const response = await mf.dispatchFetch(url.replace("tenant_a", "tenant_b"), {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(response.status).toBe(200);
      expect(await response.json()).toMatchObject({
        tenantId: "tenant_b",
        roles: ["org:member"],
        permissions: ["org:billing:write"],
      });
    });
  });
  it.each([
    ["expired", { exp: 1 }],
    ["future", { nbf: Math.floor(Date.now() / 1000) + 600 }],
    ["audience", { aud: "other-api" }],
    ["missing audience", { aud: undefined }],
    ["party", { azp: "https://evil.example.com" }],
    ["missing party", { azp: undefined }],
    ["pending", { sts: "pending" }],
    ["missing session", { sid: undefined }],
    ["unknown organization", { org_id: "org_unknown" }],
  ])("rejects %s credentials", async (_name, overrides) => {
    await fixture(async (mf) => {
      const response = await mf.dispatchFetch(url, {
        headers: { Authorization: `Bearer ${mint(overrides)}` },
      });
      expect(response.status).toBe(401);
      expect(JSON.stringify(await response.json())).not.toContain(secretKey);
    });
  });
  it.each([undefined, "https://evil.example.com"])(
    "rejects cookie writes with unsafe Origin %s",
    async (requestOrigin) => {
      await fixture(async (mf) => {
        const response = await mf.dispatchFetch(url, {
          method: "POST",
          headers: {
            Cookie: `__session=${mint()}`,
            ...(requestOrigin ? { Origin: requestOrigin } : {}),
          },
        });
        expect(response.status).toBe(401);
      });
    },
  );
  it("rejects an expired live session even with a fresh JWT", async () => {
    await fixture(
      async (mf) => {
        expect(
          (await mf.dispatchFetch(url, { headers: { Authorization: `Bearer ${mint()}` } })).status,
        ).toBe(401);
      },
      200,
      "user_abc",
      1,
    );
  });
  it("rejects a wrong signature and does not expose token material", async () => {
    await fixture(async (mf) => {
      const token = mint({}, true);
      const response = await mf.dispatchFetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(response.status).toBe(401);
      expect(JSON.stringify(await response.json())).not.toContain(token);
    });
  });
  it("isolates concurrent tenant requests and rejects switching to another tenant", async () => {
    await fixture(async (mf) => {
      const [first, second, mismatch] = await Promise.all([
        mf.dispatchFetch(url, { headers: { Authorization: `Bearer ${mint()}` } }),
        mf.dispatchFetch(url.replace("tenant_a", "tenant_b"), {
          headers: { Authorization: `Bearer ${mint({ org_id: "org_beta" })}` },
        }),
        mf.dispatchFetch(url, {
          headers: { Authorization: `Bearer ${mint({ org_id: "org_beta" })}` },
        }),
      ]);
      expect(((await first.json()) as { tenantId: string }).tenantId).toBe("tenant_a");
      expect(((await second.json()) as { tenantId: string }).tenantId).toBe("tenant_b");
      expect(mismatch.status).toBe(401);
    });
  });
  it("rechecks session state so a still-signed token fails after upstream revoke", async () => {
    await fixture(async (mf) => {
      const headers = { Authorization: `Bearer ${mint()}` };
      expect((await mf.dispatchFetch(url, { headers })).status).toBe(200);
      expect(
        (await mf.dispatchFetch("https://api.example.com/revoke", { method: "POST" })).status,
      ).toBe(204);
      expect((await mf.dispatchFetch(url, { headers })).status).toBe(401);
    });
  });
  it("rejects a session belonging to another user", async () => {
    await fixture(
      async (mf) => {
        expect(
          (await mf.dispatchFetch(url, { headers: { Authorization: `Bearer ${mint()}` } })).status,
        ).toBe(401);
      },
      200,
      "user_other",
    );
  });
  it("fails closed on upstream errors with redacted Problem output", async () => {
    await fixture(async (mf) => {
      const response = await mf.dispatchFetch(url, {
        headers: { Authorization: `Bearer ${mint()}` },
      });
      expect(response.status).toBe(500);
      expect(JSON.stringify(await response.json())).not.toContain(secretKey);
    }, 503);
  });
  it("keeps missing credentials anonymous and never falls back from an invalid header", async () => {
    await fixture(async (mf) => {
      expect((await mf.dispatchFetch(url)).status).toBe(401);
      const response = await mf.dispatchFetch(url, {
        headers: { Authorization: "Basic bad", Cookie: `__session=${mint()}` },
      });
      expect(response.status).toBe(401);
    });
  });
  it("reports missing configuration without credentials or upstream calls", async () => {
    await fixture(async (mf) => {
      const response = await mf.dispatchFetch("https://api.example.com/health");
      expect(await response.json()).toMatchObject({
        status: "unhealthy",
        details: { problemCode: "auth-clerk/missing-config" },
      });
      const invalid = await mf.dispatchFetch("https://api.example.com/config");
      expect(await invalid.json()).toMatchObject({
        diagnosticCode: "auth-clerk/workers-missing-config",
      });
    });
  });
  it("declares only the Worker auth subset in its opt-in plugin", async () => {
    await fixture(async (mf) => {
      const response = await mf.dispatchFetch("https://api.example.com/graph");
      expect(await response.json()).toMatchObject({
        name: "auth-clerk-workers",
        runtimeCompatibility: ["cloudflare-workers"],
      });
    });
  });
});
