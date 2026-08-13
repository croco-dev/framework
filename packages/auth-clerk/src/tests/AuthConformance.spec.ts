import type * as ClerkBackend from "@clerk/backend";
import { verifyToken } from "@clerk/backend";
import { verifyWebhook } from "@clerk/backend/webhooks";
import { InMemoryIdempotencyStore } from "@croco/idempotency-core";
import { ProblemCategory } from "@croco/problems-core";
import { createAuthProviderConformanceSuite } from "@croco/testing";
import { describe, expect, it, vi } from "vitest";
import { ClerkAuthDiagnosticsProvider } from "../libs/ClerkAuthDiagnosticsProvider";
import { ClerkAuthProvider } from "../libs/ClerkAuthProvider";
import { ClerkTenantMapper } from "../libs/ClerkTenantMapper";
import { ClerkWebhookHandler } from "../libs/ClerkWebhookHandler";
import { ClerkExternalServiceProblem } from "../libs/problems/ClerkProblems";
import type { AuthorizationHeaderCarrier, WebhookEventHandler } from "../libs/types";

type VerifiedToken = Awaited<ReturnType<typeof verifyToken>>;
type VerifiedWebhook = Awaited<ReturnType<typeof verifyWebhook>>;

const SECRET_SAMPLE = "super-secret-token";
const options = { secretKey: "sk_test_123", publishableKey: "pk_test_123" };

vi.mock("@clerk/backend", () => ({
  createClerkClient: vi.fn(),
  verifyToken: vi.fn(),
}));

vi.mock("@clerk/backend/webhooks", () => ({
  verifyWebhook: vi.fn(),
}));

function createRequest(authHeader?: string): AuthorizationHeaderCarrier {
  const headers = new Headers();
  if (authHeader) {
    headers.set("Authorization", authHeader);
  }
  return { headers };
}

function createWebhookRequest(): Request {
  return new Request("http://localhost/webhook", {
    method: "POST",
    headers: { "svix-id": "msg_conformance" },
    body: JSON.stringify({ type: "user.created" }),
  });
}

function createWebhookHandlerOptions() {
  return {
    signingSecret: "whsec_test",
    idempotencyStore: new InMemoryIdempotencyStore<{
      readonly deliveryId: string;
      readonly eventType: string;
      readonly outcome: "handled" | "ignored";
    }>(),
  };
}

function isClerkLiveSmokeEnabled(): boolean {
  return (
    process.env.CLERK_LIVE_SMOKE === "1" &&
    Boolean(process.env.CLERK_SECRET_KEY) &&
    Boolean(process.env.CLERK_LIVE_SESSION_TOKEN)
  );
}

describe("Clerk auth conformance", () => {
  const expectedUser = {
    id: "user_123",
    email: "user@example.com",
    roles: ["org:admin"],
    permissions: ["tenant:read"],
    metadata: {
      clerkUserId: "user_123",
      orgId: "org_123",
      orgRole: "org:admin",
      orgSlug: "croco",
      sessionId: "sess_123",
    },
  };
  const verifiedToken = {
    sub: "user_123",
    email: "user@example.com",
    org_id: "org_123",
    org_role: "org:admin",
    org_permissions: ["tenant:read"],
    org_slug: "croco",
    sid: "sess_123",
  } as unknown as VerifiedToken;
  const suite = createAuthProviderConformanceSuite({
    providerName: "auth-clerk",
    secretSamples: [SECRET_SAMPLE],
    auth: {
      expectedUser,
      authenticateValid: () => {
        vi.mocked(verifyToken).mockResolvedValueOnce(verifiedToken);
        return new ClerkAuthProvider(options).authenticate(createRequest("Bearer valid-token"));
      },
      authenticateMissingCredentials: () =>
        new ClerkAuthProvider(options).authenticate(createRequest()),
      invalidCredentials: {
        code: "auth-clerk/token-verification-failed",
        category: ProblemCategory.Unauthorized,
        retryable: false,
        run: () => {
          vi.mocked(verifyToken).mockRejectedValueOnce(new Error("jwt expired"));
          return new ClerkAuthProvider(options).authenticate(createRequest("Bearer invalid-token"));
        },
      },
      malformedPayload: {
        code: "auth-clerk/malformed-claim",
        category: ProblemCategory.Unauthorized,
        run: () => {
          vi.mocked(verifyToken).mockResolvedValueOnce({
            email: "user@example.com",
            org_permissions: ["tenant:read"],
          } as unknown as VerifiedToken);
          return new ClerkAuthProvider(options).authenticate(
            createRequest("Bearer malformed-token"),
          );
        },
      },
      upstreamFailure: {
        code: "auth-clerk/token-verification-upstream-failed",
        category: ProblemCategory.InternalServerError,
        retryable: true,
        run: () => {
          vi.mocked(verifyToken).mockRejectedValueOnce({
            status: 503,
            message: `Clerk timeout token=${SECRET_SAMPLE}`,
          });
          return new ClerkAuthProvider(options).authenticate(createRequest("Bearer upstream"));
        },
      },
    },
    webhooks: {
      processValid: async () => {
        const handler = vi.fn().mockResolvedValue(undefined);
        const handlers: WebhookEventHandler = { "user.created": handler };
        vi.mocked(verifyWebhook).mockResolvedValueOnce({
          type: "user.created",
          data: {
            id: "user_123",
            email_addresses: [{ email_address: "user@example.com" }],
          },
        } as unknown as VerifiedWebhook);

        await new ClerkWebhookHandler(createWebhookHandlerOptions(), handlers).handleWebhook(
          createWebhookRequest(),
        );

        expect(handler).toHaveBeenCalledWith({
          id: "user_123",
          email_addresses: [{ email_address: "user@example.com" }],
        });
      },
      invalidSignature: {
        code: "auth-clerk/webhook-verification-failed",
        category: ProblemCategory.Unauthorized,
        run: () => {
          vi.mocked(verifyWebhook).mockRejectedValueOnce(new Error("invalid signature"));
          return new ClerkWebhookHandler(createWebhookHandlerOptions(), {}).handleWebhook(
            createWebhookRequest(),
          );
        },
      },
      invalidPayload: {
        code: "auth-clerk/invalid-webhook-payload",
        category: ProblemCategory.ValidationError,
        run: () => {
          vi.mocked(verifyWebhook).mockResolvedValueOnce({
            type: "user.created",
            data: { email_addresses: [] },
          } as unknown as VerifiedWebhook);
          return new ClerkWebhookHandler(createWebhookHandlerOptions(), {
            "user.created": vi.fn(),
          }).handleWebhook(createWebhookRequest());
        },
      },
    },
    readiness: {
      requiredEnv: ["CLERK_SECRET_KEY"],
      createMissingConfigHealth: () =>
        new ClerkAuthDiagnosticsProvider({
          secretKey: "",
          publishableKey: "pk_test_123",
          webhookSecret: SECRET_SAMPLE,
        }).getHealth(),
      createReadyHealth: () =>
        new ClerkAuthDiagnosticsProvider({
          secretKey: SECRET_SAMPLE,
          publishableKey: "pk_test_123",
          webhookSecret: SECRET_SAMPLE,
        }).getHealth(),
    },
    tenantMapping: {
      createEvidence: async () => {
        vi.mocked(verifyToken).mockResolvedValueOnce(verifiedToken);
        const user = await new ClerkAuthProvider(options).authenticate(
          createRequest("Bearer valid-token"),
        );
        const mapper = new ClerkTenantMapper();
        await mapper.register("org_123", "tenant_123");

        return {
          externalOrgId: "org_123",
          expectedTenantId: "tenant_123",
          resolvedTenantId: await mapper.resolve({ user: user ?? undefined }),
          unknownResolvedTenantId: await mapper.resolve("org_unknown"),
          userMetadata: user?.metadata,
          expectedUserMetadata: {
            orgId: "org_123",
            orgRole: "org:admin",
          },
        };
      },
    },
    liveSmoke: {
      requiredEnv: ["CLERK_LIVE_SMOKE", "CLERK_SECRET_KEY", "CLERK_LIVE_SESSION_TOKEN"],
      isEnabled: isClerkLiveSmokeEnabled,
      run: async () => {
        const { verifyToken: verifyLiveToken } =
          await vi.importActual<typeof ClerkBackend>("@clerk/backend");
        const token = process.env.CLERK_LIVE_SESSION_TOKEN;
        const secretKey = process.env.CLERK_SECRET_KEY;
        if (!token || !secretKey) {
          throw new ClerkExternalServiceProblem(
            "Clerk live smoke is enabled without secret key and session token.",
          );
        }

        const verified = await verifyLiveToken(token, { secretKey });
        expect(verified.sub).toBeTruthy();
      },
    },
  });

  it.each(suite.cases)("$name", async ({ run }) => {
    await run();
  });

  it("treats whitespace-only secret key as missing configuration", async () => {
    const health = await new ClerkAuthDiagnosticsProvider({
      secretKey: "   ",
      publishableKey: "pk_test_123",
      webhookSecret: SECRET_SAMPLE,
    }).getHealth();

    expect(health.status).toBe("unhealthy");
    expect(health.details).toMatchObject({
      missing: ["CLERK_SECRET_KEY"],
    });
  });

  it("redacts readiness check diagnostics", async () => {
    const health = await new ClerkAuthDiagnosticsProvider(
      {
        secretKey: SECRET_SAMPLE,
        publishableKey: "pk_test_123",
        webhookSecret: SECRET_SAMPLE,
      },
      {
        readinessCheck: async () => ({
          message: `ready ${SECRET_SAMPLE}`,
          details: {
            cookie: "session=unlisted-cookie",
            privateKey: "raw-private-key",
            rawValue: SECRET_SAMPLE,
            nested: { safe: `ready ${SECRET_SAMPLE}` },
          },
        }),
      },
    ).getHealth();

    expect(health.status).toBe("healthy");
    const serialized = JSON.stringify(health);
    expect(serialized).not.toContain(SECRET_SAMPLE);
    expect(serialized).not.toContain("raw-private-key");
    expect(serialized).not.toContain("unlisted-cookie");
    expect(health.message).toBe("ready [redacted]");
  });

  it("redacts readiness check failures", async () => {
    const health = await new ClerkAuthDiagnosticsProvider(
      {
        secretKey: SECRET_SAMPLE,
        publishableKey: "pk_test_123",
        webhookSecret: SECRET_SAMPLE,
      },
      {
        readinessCheck: async () => {
          throw Object.assign(new Error(`Clerk timeout ${SECRET_SAMPLE}`), {
            status: 503,
          });
        },
      },
    ).getHealth();

    expect(health.status).toBe("degraded");
    expect(JSON.stringify(health)).not.toContain(SECRET_SAMPLE);
    expect(health.details).toMatchObject({
      problemCode: "auth-clerk/token-verification-upstream-failed",
      problemStatus: 500,
    });
  });
});
