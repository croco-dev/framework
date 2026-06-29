import { describe, expect, it } from "vitest";
import { createNotificationIdempotencyKey } from "../libs/NotificationDispatch";
import { NotificationChannel } from "../libs/types";

describe("NotificationDispatch", () => {
  it("should derive deterministic idempotency keys from notification identity", () => {
    const input = {
      tenantId: "tenant-1",
      userId: "user-1",
      channel: NotificationChannel.EMAIL,
      topic: "billing.invoice-ready",
      recipient: "ada@example.com",
      semanticKey: "invoice-1",
      template: {
        id: "invoice-ready",
        version: "v1",
        locale: "en-US",
      },
    };

    expect(createNotificationIdempotencyKey(input)).toBe(createNotificationIdempotencyKey(input));
    expect(createNotificationIdempotencyKey(input)).toBe(
      "notification:tenant-1:user-1:EMAIL:billing.invoice-ready:ada%40example.com:invoice-1:invoice-ready:v1:en-US",
    );
  });
});
