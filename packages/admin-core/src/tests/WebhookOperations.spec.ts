import { describe, expect, it } from "vitest";

import {
  assertWebhookOperationsActionRequest,
  createWebhookDeliveryAction,
  createWebhookEndpointCreationAction,
  createWebhookEndpointActions,
  executeWebhookOperationsAction,
  filterWebhookDeliveries,
  maskWebhookEndpointUrl,
  redactWebhookOperationsText,
  WebhookOperationsActionValidationProblem,
  type WebhookEndpointOperationsRow,
  type WebhookOperationsMutationExecutor,
  type WebhookOperationsReadyState,
} from "../index";

const now = new Date("2026-07-26T00:00:00.000Z");
const endpoint: WebhookEndpointOperationsRow = {
  id: "endpoint-1",
  tenantId: "tenant-1",
  maskedUrl: "https://hooks.example.com",
  subscriptions: [{ name: "order.created", schemaVersion: "v1" }],
  status: "active",
  successRate: 0.98,
  secret: {
    activeVersion: "secret-v2",
    previousVersion: "secret-v1",
    previousValidUntil: new Date("2026-07-27T00:00:00.000Z"),
  },
};

const state: WebhookOperationsReadyState = {
  kind: "ready",
  tenantId: "tenant-1",
  generatedAt: now,
  endpoints: [endpoint],
  events: [
    {
      id: "event-1",
      tenantId: "tenant-1",
      name: "order.created",
      schemaVersion: "v1",
      subject: "order-42",
      occurredAt: now,
      committedAt: now,
    },
  ],
  deliveries: [
    {
      id: "delivery-1",
      eventId: "event-1",
      endpointId: endpoint.id,
      tenantId: "tenant-1",
      status: "dead",
      attemptCount: 3,
      createdAt: now,
      updatedAt: now,
      problem: { code: "webhooks-core/outbound-permanent-failure" },
      replay: {
        allowed: true,
        reason: "Core delivery state allows replay",
      },
    },
  ],
  attempts: [],
  actions: [],
};

describe("outbound webhook operations contracts", () => {
  it("masks URL credentials and query values without accepting secret material", () => {
    expect(
      maskWebhookEndpointUrl("https://user:password@hooks.example.com/orders?token=secret"),
    ).toBe("https://hooks.example.com");
    expect(JSON.stringify(endpoint)).not.toContain("password");
    expect(JSON.stringify(endpoint)).not.toContain("material");
  });

  it("redacts hostile header, credential, and secret fixtures before diagnostics are rendered", () => {
    const hostile =
      'upstream Authorization: ApiKey super-secret\nProxy-Authorization: Digest digest-value\nCookie: first=one; second=two\nSet-Cookie: session=three; HttpOnly\nsecret="plain" token=tok';
    const redacted = redactWebhookOperationsText(hostile);

    expect(redacted).not.toContain("super-secret");
    expect(redacted).not.toContain("digest-value");
    expect(redacted).not.toContain("first=one");
    expect(redacted).not.toContain("second=two");
    expect(redacted).not.toContain("session=three");
    expect(redacted).not.toContain("plain");
    expect(redacted).not.toContain("tok");
    expect(redacted).toContain("[redacted");
  });

  it.each([
    [
      "Authorization assignment",
      "upstream rejected Authorization=Bearer fixture-a; content-type=text/plain",
      "upstream rejected [redacted]; content-type=text/plain",
    ],
    [
      "Proxy-Authorization in a header map",
      "headers=[Proxy-Authorization=Basic fixture-b, content-type=text/plain]",
      "headers=[[redacted], content-type=text/plain]",
    ],
    [
      "comma-separated signature",
      "upstream rejected webhook-signature=v1=fixture-c,v2=fixture-d, content-type: text/plain",
      "upstream rejected [redacted], content-type: text/plain",
    ],
    [
      "space-separated webhook signatures",
      "webhook-signature=v1,fixture-one== v2a,fixture-two==; content-type=text/plain",
      "[redacted]; content-type=text/plain",
    ],
    [
      "space-separated webhook signatures inside a header map",
      "headers=[webhook-signature=v1,fixture-one== v2a,fixture-two==, content-type=text/plain]",
      "headers=[[redacted], content-type=text/plain]",
    ],
    [
      "wrapped authorization value after an equals sign",
      "Authorization=Bearer\n  fixture-credential; content-type=text/plain",
      "[redacted]; content-type=text/plain",
    ],
    [
      "wrapped authorization value after a colon",
      "Proxy-Authorization: Basic\r\n\tfixture-credential\r\nupstream timed out",
      "[redacted]\r\nupstream timed out",
    ],
    [
      "unquoted API key followed by same-line error context",
      "Response headers: x-api-key=fixture-key upstream timed out",
      "Response headers: [redacted] upstream timed out",
    ],
    [
      "Bearer credential followed by same-line error context",
      "Response headers: Authorization=Bearer fixture-credential upstream timed out",
      "Response headers: [redacted] upstream timed out",
    ],
    [
      "Basic credential followed by same-line error context",
      "Response headers: Proxy-Authorization=Basic fixture-credential== upstream timed out",
      "Response headers: [redacted] upstream timed out",
    ],
    [
      "empty authorization before a distinct header in plain text",
      "Authorization=, Content-Type: text/plain",
      "[redacted], Content-Type: text/plain",
    ],
    [
      "Digest authorization followed by a distinct quoted header name",
      String.raw`headers=[Authorization=Digest realm="fixture-realm", response="fixture-response", "Content-Type"="text/plain; charset=\"utf-8\""]`,
      String.raw`headers=[[redacted], "Content-Type"="text/plain; charset=\"utf-8\""]`,
    ],
    [
      "Digest parameters with an ambiguous media type assignment",
      'headers=[Authorization=Digest realm="fixture-realm", Content-Type="text/plain", response="fixture-response", Content-Type: "application/json"]',
      'headers=[[redacted], Content-Type: "application/json"]',
    ],
    [
      "folded Digest parameter value",
      'Authorization=Digest realm=\r\n  "fixture-realm", response="fixture-response"; content-type=text/plain',
      "[redacted]; content-type=text/plain",
    ],
    [
      "signed authorization with a slash-separated credential scope",
      "headers=[Authorization: AWS4-HMAC-SHA256 Credential=fixture-id/20260101/local/sqs/aws4_request, SignedHeaders=host;x-amz-date, Signature=fixture-signature, Content-Type: text/plain] upstream timed out",
      "headers=[[redacted], Content-Type: text/plain] upstream timed out",
    ],
    [
      "opaque authorization without a safe boundary inside a map",
      "headers=[Authorization: Custom fixture opaque credential] upstream timed out",
      "headers=[[redacted]] upstream timed out",
    ],
    [
      "opaque authorization followed by a distinct map field",
      "headers=[Authorization: Custom fixture opaque credential, Content-Type: text/plain] upstream timed out",
      "headers=[[redacted], Content-Type: text/plain] upstream timed out",
    ],
    [
      "empty authorization followed by a distinct map field",
      "headers=[Authorization=, Content-Type: text/plain] upstream timed out",
      "headers=[[redacted], Content-Type: text/plain] upstream timed out",
    ],
    [
      "colon authorization in a truncated header map",
      "headers=[Authorization: Bearer fixture-truncated",
      "headers=[[redacted]",
    ],
    [
      "colon signature with a folded continuation",
      "Webhook-Signature: v1,fixture-first==\n  v2a,fixture-second==\nupstream timed out",
      "[redacted]\nupstream timed out",
    ],
    [
      "quoted signature with an escaped continuation",
      String.raw`webhook-signature="fixture-first","fixture-\"second"; content-type=text/plain`,
      "[redacted]; content-type=text/plain",
    ],
    [
      "authorization at the end of a quoted diagnostic message",
      '{"message":"upstream Authorization=Bearer fixture-message","status":503}',
      '{"message":"upstream [redacted]","status":503}',
    ],
    [
      "escaped JSON secret",
      String.raw`upstream rejected {"secret":"fixture-\"e","content-type":"text/plain"}`,
      'upstream rejected {[redacted],"content-type":"text/plain"}',
    ],
    [
      "quoted signature component followed by another component",
      'headers=["webhook-signature"="v1=fixture-f",v2=fixture-g, content-type=text/plain]',
      "headers=[[redacted], content-type=text/plain]",
    ],
    [
      "quoted authorization parameter containing punctuation",
      'Authorization: Digest realm="test, fixture: local", response="fixture-h"\ncontent-type: text/plain',
      "[redacted]\ncontent-type: text/plain",
    ],
    [
      "multiline JSON header assignment",
      '{\n"x-api-key":\n"fixture-i",\n"error.message":"Retry rejected"\n}',
      '{\n[redacted],\n"error.message":"Retry rejected"\n}',
    ],
    [
      "wrapped colon header",
      "upstream rejected x-api-key\n  : fixture-j\nRequest failed",
      "upstream rejected [redacted]\nRequest failed",
    ],
    [
      "multiline quoted token",
      'failure token="fixture-k\nfixture-l"; status=failed',
      "failure [redacted]; status=failed",
    ],
    [
      "quoted header map fields",
      'headers=["Authorization"="Basic fixture-m", "content-type"="text/plain"]',
      'headers=[[redacted], "content-type"="text/plain"]',
    ],
    [
      "mixed quoting in a header map",
      'headers=["Authorization"="Basic fixture-s", content-type=text/plain] upstream timed out',
      "headers=[[redacted], content-type=text/plain] upstream timed out",
    ],
    [
      "signature ending a header map",
      "(headers=[accept-language=[en-US,en],\nwebhook-signature=v1=fixture-n,v2=fixture-o]) upstream timed out",
      "(headers=[accept-language=[en-US,en],\n[redacted]]) upstream timed out",
    ],
    [
      "header map ending a sentence",
      "headers=[Authorization=Bearer fixture-au]. Upstream timed out",
      "headers=[[redacted]]. Upstream timed out",
    ],
    [
      "signature next to a distinct diagnostic assignment",
      "headers=[webhook-signature=v1=fixture-p\n  , v2=fixture-q, Server=example]; status=failed",
      "headers=[[redacted], Server=example]; status=failed",
    ],
    [
      "unquoted colon header with an apostrophe in its value",
      "Cookie: fixture=team's-value\nupstream timed out",
      "[redacted]\nupstream timed out",
    ],
    [
      "API key next to a distinct diagnostic assignment",
      "headers=[x-api-key=\n  fixture-r, retry.after=60]",
      "headers=[[redacted], retry.after=60]",
    ],
    [
      "cookie pairs inside a header map",
      "headers=[Authorization=Basic fixture-t, Cookie=first=fixture-u; second=fixture-ab, content-type=text/plain] upstream timed out",
      "headers=[[redacted], [redacted], content-type=text/plain] upstream timed out",
    ],
    [
      "single-quoted cookie value",
      "headers=[Cookie='first=fixture-ac, second=fixture-ad', content-type=text/plain]",
      "headers=[[redacted], content-type=text/plain]",
    ],
    [
      "Digest assignment followed by diagnostic metadata",
      'Authorization=Digest realm="fixture-ae", response="fixture-af"; content-type=text/plain',
      "[redacted]; content-type=text/plain",
    ],
    [
      "Digest assignment in a header map",
      'headers=[Authorization=Digest realm="fixture-ai", response="fixture-aj", content-type=text/plain]',
      "headers=[[redacted], content-type=text/plain]",
    ],
    [
      "Digest assignment containing an empty list element",
      'headers=[accept=text/plain, Authorization: Digest realm="fixture-ao"\n  , , response="fixture-ap", content-type=text/plain]',
      "headers=[accept=text/plain, [redacted], content-type=text/plain]",
    ],
    [
      "quoted authorization next to diagnostic timing data",
      '"Authorization"="Basic fixture-aq", t=60 upstream timed out',
      "[redacted], t=60 upstream timed out",
    ],
    [
      "array-valued authorization entry",
      'headers={"Authorization":["Basic fixture-bb"],"content-type":"text/plain","response":{"transport":{"status":503}}} upstream timed out',
      'headers={[redacted],"content-type":"text/plain","response":{"transport":{"status":503}}} upstream timed out',
    ],
    [
      "multiline authorization entry inside a nested map",
      '{"headers":{"Authorization":[\n"Basic fixture-bg",\n"Bearer fixture-bh"\n],"content-type":"text/plain"},"status":503} upstream timed out',
      '{"headers":{[redacted],"content-type":"text/plain"},"status":503} upstream timed out',
    ],
    [
      "quoted colon header followed by retry context",
      '"x-api-key": fixture-bc; retrying in 60 seconds',
      "[redacted]; retrying in 60 seconds",
    ],
    [
      "colon assignment inside a header map",
      "headers=[x-api-key: fixture-ak, content-type=text/plain]",
      "headers=[[redacted], content-type=text/plain]",
    ],
    [
      "closing punctuation inside an opaque API key",
      "upstream rejected x-api-key=fixture-al]fixture-am; retrying in 60 seconds",
      "upstream rejected [redacted]; retrying in 60 seconds",
    ],
    [
      "apostrophe in an unquoted cookie map entry",
      "headers=[Cookie=session=team's-fixture, content-type=text/plain]",
      "headers=[[redacted], content-type=text/plain]",
    ],
    [
      "cookie assignment followed by response metadata",
      'upstream rejected "Cookie"=first=fixture-ar; second=fixture-as, content-type=text/plain',
      "upstream rejected [redacted], content-type=text/plain",
    ],
    [
      "Set-Cookie assignment followed by a distinct response header",
      "Set-Cookie=session=fixture-at; HttpOnly, content-type: text/plain",
      "[redacted], content-type: text/plain",
    ],
    [
      "multiple Set-Cookie values inside a header map",
      "headers=[accept: text/plain, Set-Cookie: first=fixture-bd, second=fixture-be, content-type: text/plain]",
      "headers=[accept: text/plain, [redacted], content-type: text/plain]",
    ],
    [
      "quoted cookie value before another JSON header",
      '{"Set-Cookie":"session=fixture-bi","Content-Type":"text/plain"}',
      '{[redacted],"Content-Type":"text/plain"}',
    ],
    [
      "unquoted Set-Cookie before a quoted map field",
      'headers=[Set-Cookie=session=fixture-bj; HttpOnly, "Content-Type"="text/plain"]',
      'headers=[[redacted], "Content-Type"="text/plain"]',
    ],
    [
      "unquoted Set-Cookie before compact header metadata",
      "Set-Cookie=session=fixture-bk; HttpOnly, content-type:text/plain",
      "[redacted], content-type:text/plain",
    ],
    [
      "multiline quoted authorization followed by diagnostic prose",
      '"Authorization"="fixture-ag\nfixture-ah" upstream timed out',
      "[redacted] upstream timed out",
    ],
    [
      "quoted authorization followed by a diagnostic sentence",
      'upstream rejected "Authorization"="Basic fixture-v"; retrying in 60 seconds',
      "upstream rejected [redacted]; retrying in 60 seconds",
    ],
    [
      "complete versioned signature followed by a diagnostic sentence",
      "webhook-signature=v1=fixture-w,v2=fixture-x, upstream timed out",
      "[redacted], upstream timed out",
    ],
    [
      "quoted signature followed by semicolon-delimited diagnostics",
      'webhook-signature="v1=fixture-bf"; retrying; HTTP 503',
      "[redacted]; retrying; HTTP 503",
    ],
    [
      "unquoted authorization followed by a comma-separated diagnostic sentence",
      "Authorization=Bearer fixture-an, upstream timed out",
      "[redacted], upstream timed out",
    ],
    [
      "single-token proxy authorization assignment",
      "Proxy-Authorization=fixture-ay; content-type=text/plain",
      "[redacted]; content-type=text/plain",
    ],
    [
      "opaque signature components next to a distinct diagnostic field",
      "webhook-signature=fixture-az,fixture-ba, content-type=text/plain",
      "[redacted], content-type=text/plain",
    ],
    [
      "header assignment next to a multiline quoted secret",
      'upstream rejected Cookie=first=fixture-y; secret="fixture-z\nfixture-aa"',
      "upstream rejected [redacted]",
    ],
    [
      "header assignment next to a multiline quoted credential header",
      'upstream rejected Cookie=first=fixture-av "x-api-key"="fixture-aw\nfixture-ax"',
      "upstream rejected [redacted]",
    ],
  ])(
    "redacts a complete %s and preserves surrounding diagnostic text",
    (_label, input, expected) => {
      expect(redactWebhookOperationsText(input)).toBe(expected);
    },
  );

  it("exposes endpoint actions with explicit pause and rotation semantics", () => {
    const actions = createWebhookEndpointActions(
      endpoint,
      ["webhooks:write", "webhooks:secrets:rotate"],
      now,
    );

    expect(actions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "pause-endpoint",
          allowed: true,
          reason: expect.stringContaining("not canceled"),
        }),
        expect.objectContaining({
          kind: "rotate-secret",
          allowed: true,
          reason: expect.stringContaining("presented once"),
        }),
        expect.objectContaining({
          kind: "revoke-previous-secret",
          allowed: true,
        }),
      ]),
    );
  });

  it("requires write permission before creating an endpoint with a one-time secret", () => {
    expect(createWebhookEndpointCreationAction("tenant-1", ["webhooks:write"])).toMatchObject({
      allowed: true,
      auditEvent: "webhook.create-endpoint",
      kind: "create-endpoint",
      reason: expect.stringContaining("one-time secret"),
      targetId: "tenant-1",
    });
    expect(createWebhookEndpointCreationAction("tenant-1", [])).toMatchObject({
      allowed: false,
      permission: "webhooks:write",
    });
  });

  it.each(["pending", "retrying", "accepted"] as const)(
    "does not expose replay for unsafe %s deliveries",
    (status) => {
      const action = createWebhookDeliveryAction(
        {
          ...deliveryFixture(),
          status,
          replay: { allowed: true, reason: "Hostile caller-forged replay flag" },
        },
        endpoint,
        ["webhooks:replay"],
      );

      expect(action).toMatchObject({
        allowed: false,
        kind: "replay-delivery",
        reason: expect.stringContaining("not replayable"),
      });
    },
  );

  it("allows an auditable replay of the same logical event for core-declared safe states", () => {
    expect(
      createWebhookDeliveryAction(deliveryFixture(), endpoint, ["webhooks:replay"]),
    ).toMatchObject({
      allowed: true,
      kind: "replay-delivery",
      targetId: "delivery-1",
      reason: expect.stringContaining("existing logical event"),
    });
  });

  it("keeps acceptance-unknown replay disabled unless the core contract explicitly allows it", () => {
    const acceptanceUnknown = {
      ...deliveryFixture(),
      status: "acceptance-unknown" as const,
      replay: undefined,
    };

    expect(
      createWebhookDeliveryAction(acceptanceUnknown, endpoint, ["webhooks:replay"]),
    ).toMatchObject({
      allowed: false,
      reason: expect.stringContaining("did not declare"),
    });
    expect(
      createWebhookDeliveryAction(
        {
          ...acceptanceUnknown,
          replay: { allowed: true, reason: "Core replay contract allows terminal recovery" },
        },
        endpoint,
        ["webhooks:replay"],
      ),
    ).toMatchObject({
      allowed: true,
      targetId: "delivery-1",
    });
  });

  it("requires actor, reason, and idempotency evidence for every write", () => {
    const complete = {
      action: "replay-delivery",
      actorId: "operator-1",
      idempotencyKey: "replay-1",
      reason: "Provider confirmed no receipt",
      targetId: "delivery-1",
      tenantId: "tenant-1",
    } as const;

    expect(assertWebhookOperationsActionRequest(complete)).toBe(complete);
    for (const field of ["actorId", "reason", "idempotencyKey"] as const) {
      expect(() => assertWebhookOperationsActionRequest({ ...complete, [field]: " " })).toThrow(
        WebhookOperationsActionValidationProblem,
      );
    }
  });

  it("binds permitted writes to tenant, target, action, audit, and idempotency execution", async () => {
    const action = createWebhookDeliveryAction(deliveryFixture(), endpoint, ["webhooks:replay"]);
    const request = {
      action: "replay-delivery",
      actorId: "operator-1",
      idempotencyKey: "replay-1",
      reason: "Provider confirmed no receipt",
      targetId: "delivery-1",
      tenantId: "tenant-1",
    } as const;
    const executor: WebhookOperationsMutationExecutor<string> = {
      execute: async (input) => input.request.idempotencyKey,
    };

    await expect(
      executeWebhookOperationsAction({
        action,
        executor,
        expectedTenantId: "tenant-1",
        grantedPermissions: ["webhooks:replay"],
        request,
      }),
    ).resolves.toBe("replay-1");
    await expect(
      executeWebhookOperationsAction({
        action,
        executor,
        expectedTenantId: "tenant-2",
        grantedPermissions: ["webhooks:replay"],
        request,
      }),
    ).rejects.toBeInstanceOf(WebhookOperationsActionValidationProblem);
  });

  it("filters delivery evidence through the matching logical event without mixing attempts", () => {
    expect(
      filterWebhookDeliveries(state, {
        tenantId: "tenant-1",
        eventName: "order.created",
        schemaVersion: "v1",
        subject: "order-42",
        states: ["dead"],
        problemCode: "webhooks-core/outbound-permanent-failure",
      }),
    ).toEqual(state.deliveries);
    expect(
      filterWebhookDeliveries(state, {
        tenantId: "tenant-1",
        eventName: "order.updated",
      }),
    ).toEqual([]);
  });
});

function deliveryFixture() {
  const [delivery] = state.deliveries;
  if (delivery === undefined) {
    throw new Error("Expected the state fixture to include a delivery");
  }
  return delivery;
}
