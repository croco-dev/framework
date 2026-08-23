import { NotificationChannel } from "@croco/notifications-core";
import { createNotificationProviderConformanceSuite } from "@croco/testing/notifications";
import { describe, it } from "vitest";
import { ResendProvider } from "../libs/ResendProvider";

describe("Resend notification provider conformance", () => {
  const expectedCapabilities = {
    providerName: "resend",
    channels: [NotificationChannel.EMAIL],
    supportsIdempotencyKey: true,
    supportsProviderTemplates: false,
    supportsRenderedTemplates: true,
    outboxIntegration: "consumer-managed",
  } as const;
  const suite = createNotificationProviderConformanceSuite({
    createProvider: () =>
      new ResendProvider({
        apiKey: "re_conformance_test_key",
        from: "notifications@example.com",
      }),
    expectedCapabilities,
  });

  it.each(suite.cases)("$name", async ({ run }) => {
    await run();
  });
});
