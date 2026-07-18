import { describe, expect, it } from "vitest";
import { Context, RuntimeInspector } from "../index";

describe("RuntimeInspector", () => {
  it("captures active request events with sensitive fields redacted", async () => {
    const inspector = new RuntimeInspector();
    inspector.startRequest({
      requestId: "req-1",
      method: "GET",
      path: "/users",
      headers: {
        authorization: "Bearer secret",
        "x-request-id": "req-1",
      },
      query: {
        apiKey: "secret-key",
        page: "1",
      },
    });

    await Context.run({ requestId: "req-1" }, async () => {
      inspector.recordEvent({
        kind: "handler.end",
        outcome: "succeeded",
        details: {
          safe: true,
          nested: {
            password: "secret-password",
          },
        },
      });
    });
    inspector.finishRequest({ requestId: "req-1", status: 200, outcome: "succeeded" });

    const snapshot = inspector.snapshot();

    expect(snapshot.activeRequestCount).toBe(0);
    expect(snapshot.requests[0]).toMatchObject({
      requestId: "req-1",
      method: "GET",
      path: "/users",
      status: 200,
      outcome: "succeeded",
      headers: {
        authorization: "[Redacted]",
        "x-request-id": "req-1",
      },
      query: {
        apiKey: "[Redacted]",
        page: "1",
      },
    });
    expect(snapshot.requests[0].timeline).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "handler.end",
          details: {
            safe: true,
            nested: {
              password: "[Redacted]",
            },
          },
        }),
      ]),
    );
  });

  it("keeps request start while bounding timeline events", () => {
    const inspector = new RuntimeInspector({ maxEventsPerRequest: 2 });
    inspector.startRequest({ requestId: "req-1" });

    inspector.recordEvent({ requestId: "req-1", kind: "middleware.start" });
    inspector.recordEvent({ requestId: "req-1", kind: "handler.start" });
    inspector.recordEvent({ requestId: "req-1", kind: "handler.end" });

    const timeline = inspector.snapshot().requests[0].timeline;

    expect(timeline.map((event) => event.kind)).toEqual(["request.start", "handler.end"]);
  });

  it("retains the configured maximum number of requests", () => {
    const inspector = new RuntimeInspector({ maxRequests: 2 });

    inspector.startRequest({ requestId: "req-1" });
    inspector.startRequest({ requestId: "req-2" });
    inspector.startRequest({ requestId: "req-3" });

    const snapshot = inspector.snapshot();

    expect(snapshot.requestCount).toBe(2);
    expect(snapshot.activeRequestCount).toBe(2);
    expect(snapshot.requests.map((request) => request.requestId)).toEqual(["req-3", "req-2"]);
  });

  it("retains 50 requests when maxRequests is omitted", () => {
    const inspector = new RuntimeInspector();

    for (let requestNumber = 1; requestNumber <= 51; requestNumber += 1) {
      inspector.startRequest({ requestId: `req-${requestNumber}` });
    }

    const snapshot = inspector.snapshot();

    expect(snapshot.requestCount).toBe(50);
    expect(snapshot.activeRequestCount).toBe(50);
    expect(snapshot.requests[0].requestId).toBe("req-51");
    expect(snapshot.requests[49].requestId).toBe("req-2");
    expect(snapshot.requests.some((request) => request.requestId === "req-1")).toBe(false);
  });

  it("truncates strings at the configured maximum length", () => {
    const inspector = new RuntimeInspector({ maxStringLength: 3 });

    inspector.startRequest({ requestId: "req-1", runtime: { note: "abcdef" } });

    expect(inspector.snapshot().requests[0].runtime?.note).toBe("abc...[Truncated]");
  });

  it("truncates strings at 500 characters when maxStringLength is omitted", () => {
    const inspector = new RuntimeInspector();

    inspector.startRequest({ requestId: "req-1", runtime: { note: "x".repeat(501) } });

    expect(inspector.snapshot().requests[0].runtime?.note).toBe(`${"x".repeat(500)}...[Truncated]`);
  });

  it("keeps duplicate request ids isolated when an inspection id is active", async () => {
    const inspector = new RuntimeInspector();
    const first = inspector.startRequest({ requestId: "duplicate-req" });
    const second = inspector.startRequest({ requestId: "duplicate-req" });

    await Promise.all([
      Context.run({ requestId: "duplicate-req", inspectionId: first.id }, async () => {
        inspector.recordEvent({
          kind: "handler.end",
          name: "first",
          details: { message: "token=first-secret" },
        });
        inspector.finishRequest({ status: 200, outcome: "succeeded" });
      }),
      Context.run({ requestId: "duplicate-req", inspectionId: second.id }, async () => {
        inspector.recordEvent({
          kind: "handler.end",
          name: "second",
          details: { message: "token=second-secret" },
        });
        inspector.finishRequest({ status: 201, outcome: "succeeded" });
      }),
    ]);

    const snapshot = inspector.snapshot();
    const firstRecord = snapshot.requests.find((request) => request.id === first.id);
    const secondRecord = snapshot.requests.find((request) => request.id === second.id);

    expect(firstRecord).toMatchObject({ status: 200 });
    expect(firstRecord?.timeline).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "first",
          details: { message: "token=[Redacted]" },
        }),
      ]),
    );
    expect(secondRecord).toMatchObject({ status: 201 });
    expect(secondRecord?.timeline).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "second",
          details: { message: "token=[Redacted]" },
        }),
      ]),
    );
    expect(JSON.stringify(snapshot)).not.toContain("first-secret");
    expect(JSON.stringify(snapshot)).not.toContain("second-secret");
  });

  it("snapshots redaction coverage across request and timeline surfaces", () => {
    const inspector = new RuntimeInspector();
    inspector.startRequest({
      requestId: "req-redaction",
      method: "POST",
      path: "/diagnostics",
      route: "/diagnostics",
      url: "/diagnostics?token=url-token&ApiKey=url-api-key&dsn=https://public@sentry.example/1&safe=value",
      headers: {
        Authorization: "Bearer header-secret",
        Cookie: "session=header-cookie",
        "x-safe-header": "safe-header",
      },
      query: {
        TOKEN: "query-token",
        api_key: "query-api-key",
        safe: "query-safe",
        nested: {
          databaseUrl: "postgres://user:password@db.example/app",
        },
      },
      runtime: {
        databaseURL: "postgres://runtime:secret@db.example/app",
        array: [
          { token: "array-token" },
          "Authorization: Bearer array-secret",
          "Set-Cookie: session=set-cookie-secret; Path=/; HttpOnly; csrf=set-cookie-csrf databaseUrl=postgres://user:pass@db.example/app",
          "Set-Cookie: session=first-cookie; Path=/, refresh=second-cookie; HttpOnly databaseUrl=postgres://user:pass@db.example/app",
          new Error(
            "cookie=session-secret; refresh=refresh-secret databaseUrl=postgres://user:pass@db.example/app",
          ),
        ],
      },
    });
    inspector.recordEvent({
      requestId: "req-redaction",
      kind: "error",
      outcome: "failed",
      details: {
        message: "apiKey=timeline-api-key dsn=https://public@sentry.example/1",
        nested: {
          Authorization: "Bearer nested-secret",
          values: ["token=array-token", { connectionString: "redis://:secret@redis.example:6379" }],
        },
        error: new Error(
          "Cookie: session=error-cookie; csrf=csrf-secret databaseUrl=mysql://user:pass@db.example/app",
        ),
      },
    });
    inspector.finishRequest({
      requestId: "req-redaction",
      status: 500,
      outcome: "failed",
      details: {
        databaseUrl: "postgres://finish:secret@db.example/app",
      },
    });

    const snapshot = inspector.snapshot();
    const request = snapshot.requests[0];
    const redactionShape = {
      activeRequestCount: snapshot.activeRequestCount,
      requestCount: snapshot.requestCount,
      request: {
        requestId: request.requestId,
        method: request.method,
        path: request.path,
        route: request.route,
        url: request.url,
        status: request.status,
        outcome: request.outcome,
        headers: request.headers,
        query: request.query,
        runtime: request.runtime,
        timeline: request.timeline.map((event) => ({
          kind: event.kind,
          outcome: event.outcome,
          details: event.details,
        })),
      },
    };

    expect(redactionShape).toMatchInlineSnapshot(`
      {
        "activeRequestCount": 0,
        "request": {
          "headers": {
            "Authorization": "[Redacted]",
            "Cookie": "[Redacted]",
            "x-safe-header": "safe-header",
          },
          "method": "POST",
          "outcome": "failed",
          "path": "/diagnostics",
          "query": {
            "TOKEN": "[Redacted]",
            "api_key": "[Redacted]",
            "nested": {
              "databaseUrl": "[Redacted]",
            },
            "safe": "query-safe",
          },
          "requestId": "req-redaction",
          "route": "/diagnostics",
          "runtime": {
            "array": [
              {
                "token": "[Redacted]",
              },
              "Authorization: Bearer [Redacted]",
              "Set-Cookie: [Redacted] databaseUrl=[Redacted]",
              "Set-Cookie: [Redacted] databaseUrl=[Redacted]",
              {
                "message": "cookie=[Redacted] databaseUrl=[Redacted]",
                "name": "Error",
              },
            ],
            "databaseURL": "[Redacted]",
          },
          "status": 500,
          "timeline": [
            {
              "details": {
                "method": "POST",
                "path": "/diagnostics",
                "route": "/diagnostics",
                "runtime": {
                  "array": [
                    {
                      "token": "[Redacted]",
                    },
                    "Authorization: Bearer [Redacted]",
                    "Set-Cookie: [Redacted] databaseUrl=[Redacted]",
                    "Set-Cookie: [Redacted] databaseUrl=[Redacted]",
                    {
                      "message": "cookie=[Redacted] databaseUrl=[Redacted]",
                      "name": "Error",
                    },
                  ],
                  "databaseURL": "[Redacted]",
                },
                "trace": undefined,
              },
              "kind": "request.start",
              "outcome": "started",
            },
            {
              "details": {
                "error": {
                  "message": "Cookie: [Redacted] databaseUrl=[Redacted]",
                  "name": "Error",
                },
                "message": "apiKey=[Redacted] dsn=[Redacted]",
                "nested": {
                  "Authorization": "[Redacted]",
                  "values": [
                    "token=[Redacted]",
                    {
                      "connectionString": "[Redacted]",
                    },
                  ],
                },
              },
              "kind": "error",
              "outcome": "failed",
            },
            {
              "details": {
                "databaseUrl": "[Redacted]",
                "status": 500,
              },
              "kind": "request.end",
              "outcome": "failed",
            },
          ],
          "url": "/diagnostics?token=%5BRedacted%5D&ApiKey=%5BRedacted%5D&dsn=%5BRedacted%5D&safe=value",
        },
        "requestCount": 1,
      }
    `);
    const serializedSnapshot = JSON.stringify(snapshot);
    for (const secret of [
      "header-secret",
      "header-cookie",
      "url-token",
      "url-api-key",
      "query-token",
      "query-api-key",
      "runtime:secret",
      "array-secret",
      "array-token",
      "timeline-api-key",
      "nested-secret",
      "csrf",
      "csrf-secret",
      "set-cookie-secret",
      "set-cookie-csrf",
      "first-cookie",
      "second-cookie",
      "session-secret",
      "refresh",
      "refresh-secret",
      "error-cookie",
      "finish:secret",
      "db.example",
      "redis.example",
      "sentry.example",
    ]) {
      expect(serializedSnapshot).not.toContain(secret);
    }
  });

  it("uses a custom sensitive key pattern for request snapshots", () => {
    const inspector = new RuntimeInspector({ sensitiveKeyPattern: /tenant[-_]?id/i });
    inspector.startRequest({
      requestId: "req-custom",
      headers: {
        tenantId: "tenant-secret",
        authorization: "authorization-visible-with-custom-pattern",
      },
      query: {
        tenant_id: "query-tenant-secret",
        token: "token-visible-with-custom-pattern",
      },
      url: "/tenants?tenantId=url-tenant-secret&token=url-token-visible",
    });

    expect(inspector.snapshot().requests[0]).toMatchObject({
      headers: {
        tenantId: "[Redacted]",
        authorization: "authorization-visible-with-custom-pattern",
      },
      query: {
        tenant_id: "[Redacted]",
        token: "token-visible-with-custom-pattern",
      },
      url: "/tenants?tenantId=%5BRedacted%5D&token=url-token-visible",
    });
  });
});
