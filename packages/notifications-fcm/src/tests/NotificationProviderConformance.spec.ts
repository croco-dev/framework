import { createNotificationProviderConformanceSuite } from "@croco/testing/notifications";
import { describe, it } from "vitest";
import { FcmProvider, FCM_PROVIDER_CAPABILITIES } from "../index";

describe("FCM notification provider conformance", () => {
  const suite = createNotificationProviderConformanceSuite({
    createProvider: () =>
      new FcmProvider(
        { projectId: "fixture-project", credential: { type: "application-default" } },
        { send: async () => "fixture-message-id" },
      ),
    expectedCapabilities: FCM_PROVIDER_CAPABILITIES,
  });
  it.each(suite.cases)("$name", async ({ run }) => {
    await run();
  });
});
