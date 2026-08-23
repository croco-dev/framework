import { createNotificationProviderConformanceSuite } from "@croco/testing/notifications";
import { describe, it } from "vitest";
import { NotificationChannel } from "../libs/types";
import { createProvider } from "./__fixtures__/mockProvider";

describe("notification provider conformance", () => {
  const expectedCapabilities = {
    providerName: "test-email-provider",
    channels: [NotificationChannel.EMAIL],
    supportsIdempotencyKey: true,
    supportsProviderTemplates: false,
    supportsRenderedTemplates: true,
    outboxIntegration: "consumer-managed",
  } as const;
  const suite = createNotificationProviderConformanceSuite({
    createProvider: () =>
      createProvider("test-email-provider", NotificationChannel.EMAIL, expectedCapabilities),
    expectedCapabilities,
  });

  it.each(suite.cases)("$name", async ({ run }) => {
    await run();
  });
});
