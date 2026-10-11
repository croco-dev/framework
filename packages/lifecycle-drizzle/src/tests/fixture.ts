import type { JourneyEpisode } from "@croco/lifecycle-core";
export function episode(): JourneyEpisode {
  return {
    id: "episode-1",
    scope: { appId: "shop", environment: "test", tenantId: "a" },
    subject: "customer-1",
    businessObjectRef: "cart-1",
    episodeKey: "once",
    reentryKey: "cart-1/customer-1/once",
    sourceEventId: "event-1",
    definitionId: "cart",
    definitionVersion: "v1",
    definitionSnapshot: '{"id":"cart","version":"v1"}',
    nodeId: "wait",
    wakeAt: "2026-09-29T01:00:00.000Z",
    status: "waiting",
    revision: 0,
    startedAt: "2026-09-29T00:00:00.000Z",
    unknownSince: null,
    unknownSource: null,
    reason: "wait",
    receipts: [],
    intents: [],
    commands: [],
    reconciliations: [],
  };
}
