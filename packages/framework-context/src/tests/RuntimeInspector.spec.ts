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
});
