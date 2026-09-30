# @croco/engagement-core

Typed, inspectable message definitions and explicit renderer bindings for Croco engagement features.

```ts
import {
  defineMessage,
  type MessageContext,
  type MessageRenderer,
  Renders,
} from "@croco/engagement-core";
import { z } from "zod";

const TrialEnding = defineMessage({
  id: "billing.trial-ending",
  topic: "billing",
  data: z.object({ tenantName: z.string(), upgradeUrl: z.string().url() }),
  channels: ["email", "push"],
});

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    switch (character) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      default:
        return "&#39;";
    }
  });
}

@Renders(TrialEnding)
class TrialEndingRenderer implements MessageRenderer<typeof TrialEnding> {
  email({ data }: MessageContext<typeof TrialEnding>) {
    return {
      subject: "Trial ending",
      html: `<p>${escapeHtml(data.tenantName)}</p>`,
      text: data.tenantName,
    };
  }

  push({ data }: MessageContext<typeof TrialEnding>) {
    return { title: "Trial ending", body: data.tenantName, deepLink: data.upgradeUrl };
  }
}
```

Register messages and renderer constructors explicitly in `MessageRendererRegistry`, then call `bootstrap()` before rendering. The decorator stores a binding only: it never registers a provider or instantiates a renderer.

## Recipient-based dispatch

Application call sites send a logical recipient, typed message data, and a semantic key. Email addresses, push tokens, provider names, preference contexts, and full idempotency keys stay behind `EngagementService`.

```ts
import {
  EngagementService,
  type EngagementNotificationDispatcher,
  InMemoryMessageRendererResolver,
  InMemoryRecipientDirectory,
  MessageRendererRegistry,
  RegistryEngagementMessageRenderer,
} from "@croco/engagement-core";

const messageRegistry = new MessageRendererRegistry();
messageRegistry.registerMessage(TrialEnding);
messageRegistry.registerRenderer(TrialEndingRenderer);
messageRegistry.bootstrap();

const rendererResolver = new InMemoryMessageRendererResolver();
rendererResolver.register(TrialEnding, new TrialEndingRenderer());

const directory = new InMemoryRecipientDirectory([
  {
    recipient: { tenantId: "tenant-1", userId: "user-1" },
    email: { id: "primary-email", address: "user@example.com" },
    push: [],
    locale: "en-US",
    timezone: "Asia/Seoul",
  },
]);

// Supplied by the application's dependency-injection container.
declare const notificationService: EngagementNotificationDispatcher;

const engagement = new EngagementService(
  directory,
  new RegistryEngagementMessageRenderer(messageRegistry, rendererResolver),
  notificationService,
);

const result = await engagement.send(TrialEnding, {
  recipient: { tenantId: "tenant-1", userId: "user-1" },
  data: { tenantName: "Croco", upgradeUrl: "https://croco.dev/upgrade" },
  key: "subscription-1",
});
```

The default `first-reachable` policy follows the message's declared channel order. Use `policy: "all-reachable"` to dispatch every usable email or push endpoint. Preference denial, suppression, and missing endpoints return explicit non-provider outcomes; recipient lookup, rendering, and provider failures remain typed Problems. `InMemoryRecipientDirectory` is intended for tests and single-process examples. Durable endpoints, preferences, and suppressions belong in storage-backed implementations.

## Audience snapshots and one-shot campaigns

Keep audience queries in application code, then connect their member type to a message with `defineCampaign()`. Every mapped member supplies a semantic key; the mapper's `data` is checked against the message schema.

```ts
import {
  Audience,
  AudienceRegistry,
  CampaignBroadcastService,
  CampaignRegistry,
  CampaignSnapshotService,
  InMemoryCampaignStore,
  campaignScopeForTenant,
  defineCampaign,
  type AudienceContext,
  type AudienceSource,
} from "@croco/engagement-core";
import type { ExecutionManager } from "@croco/execution-core";

type InactiveTrialMember = {
  recipient: { tenantId: string; userId: string };
  subscriptionId: string;
  tenantName: string;
  upgradeUrl: string;
};

interface SubscriptionRepository {
  findInactiveTrials(context: AudienceContext): AsyncIterable<InactiveTrialMember>;
}

@Audience("inactive-trials")
class InactiveTrials implements AudienceSource<InactiveTrialMember> {
  constructor(private readonly subscriptions: SubscriptionRepository) {}

  members(context: AudienceContext) {
    return this.subscriptions.findInactiveTrials(context);
  }
}

const TrialReminder = defineCampaign({
  id: "trial-reminder",
  version: "2026-09-02",
  audience: InactiveTrials,
  message: TrialEnding,
  map: (member) => ({
    recipient: member.recipient,
    data: { tenantName: member.tenantName, upgradeUrl: member.upgradeUrl },
    key: member.subscriptionId,
  }),
});

const audiences = new AudienceRegistry();
declare const subscriptions: SubscriptionRepository;
audiences.register(InactiveTrials, new InactiveTrials(subscriptions));
const campaigns = new CampaignRegistry();
campaigns.register(TrialReminder);
const store = new InMemoryCampaignStore();
const snapshots = new CampaignSnapshotService(audiences, store);
declare const executionManager: ExecutionManager;
const broadcasts = new CampaignBroadcastService(campaigns, store, executionManager, engagement);

const { snapshot } = await snapshots.createSnapshot(TrialReminder, { tenantId: "tenant-1" });
const result = await broadcasts.broadcast(
  TrialReminder,
  campaignScopeForTenant("tenant-1"),
  snapshot.id,
);
```

Snapshot creation streams the audience into an immutable, descriptor-pinned member set before any provider dispatch. Re-running the broadcast resumes from stored member outcomes and does not re-query the audience or create a second logical send for an already completed member.

For one absolute future run, inject a `CampaignExecutionPublisher` into `CampaignBroadcastService` and call `schedule()` with `scheduledFor`. The publisher receives the persisted execution ID and idempotency key, and must invoke `execute()` at the requested time. Recurring schedules and recipient-local-time fan-out are intentionally outside this contract.

## Optional contact budgets

`ContactPolicy` adds recipient budgets to the existing send path. Install the gate as the seventh
`EngagementService` constructor argument: `{ policy, app, environment, fingerprint }`. Supply a
cryptographic fingerprint function (for example SHA-256 of a canonical JSON encoding); it receives
message data, rendered content and endpoint identity, but only the digest enters the budget ledger.
The default service without this gate and direct notification provider calls bypass these budgets.
The gate does not claim control over those sends.

```typescript
const policy = new ContactPolicy({
  store: new InMemoryContactPolicyStore(),
  config: {
    version: "marketing-1",
    reservationTtlMs: 60_000,
    rules: [{ id: "daily-email", channel: "email", limit: 2, windowMs: 86_400_000 }],
    quietHours: { startMinute: 22 * 60, endMinute: 9 * 60, timezone: "Asia/Seoul" },
  },
  topics: [{ id: "marketing", kind: "marketing", priority: 1, messageIds: ["sale"] }],
});
```

These example limits are application settings, not a recommended universal contact frequency.
Scope requires app, environment and tenant. Subject defaults to the logical recipient; shared
endpoint grouping requires an explicit `verifyEndpointGroup` mapping. Matching contact strings do
not merge recipient identities. Topic kind and message membership are server registrations;
transactional/security exceptions never bypass preferences or suppression.

`evaluate` reads the ledger and runs the same evaluator as `reserve`, without saving or consuming.
Rules use rolling elapsed-time windows; timezone applies to quiet hours, including daylight-saving
transitions. Quiet hours include the start minute and exclude the end minute. When a decision includes
`nextEligibleAt`, that instant satisfies every applicable rule and quiet hours against the current
ledger; new concurrent reservations can still change the result. New reservations use the current
config revision. Replays retain their original policy revision and result; prior charges
remain visible to new rules. `reserveBatch` orders only the supplied batch by descending registered
topic priority, then ascending logical send ID (code-unit comparison). Independent future requests
have no priority guarantee.

Reservations charge one logical channel, even when multiple endpoints receive it. Logical IDs are
scoped to the budget subject. A replay with a different fingerprint, message, channel, topic or
recipient fails with `ContactPolicyConflictProblem`. Use stable IDs and stable group mappings.
The in-memory store is process-local; durable deployments require an atomic `ContactPolicyStore`
implementation such as the engagement-drizzle adapter.

The execution adapter renders and evaluates preferences before reserving. It marks the reservation
`unknown` before calling the provider and commits returned execution IDs after all endpoints succeed.
Provider failure or a failed local commit preserves `unknown` and prevents automatic resend.
`release` only accepts `reserved`, so it is suitable solely for confirmed pre-dispatch cancellation.
Expiry does not release a reservation: an expired pending replay reports unknown and its original
charge remains in the rolling window. Unknown acceptance needs external reconciliation. `reconcile(ref, resolution)` requires a verified
provider evidence reference, actor and reason. An accepted resolution records execution IDs and commits;
proven non-acceptance releases the charge. Normal `release` still rejects unknown reservations.
The caller verifies that evidence; supply opaque proof references, not contact data or raw provider payloads. Policy denial
is returned as suppression with `contactPolicyDecision`; when a dispatch store is installed, the
suppressed outcome stores app/environment, blocking rule, reason and the next eligible timestamp.
The ledger contains opaque recipient and message identities, never endpoint addresses or tokens.

For operator-editable settings, replace `policy` with `resolvePolicy(scope): Promise<ContactPolicy>`
in the gate. The resolver reads the authorized scoped settings and constructs the policy with the
same durable store and code-registered topics. EngagementService calls it immediately before each
new channel reservation, after preferences and rendering. The selected instance handles that
reservation through commit. Configuration updates therefore apply to the next reservation; replay
continues to return the original stored revision. A resolver error fails the send before dispatch.

Campaign broadcasts pass `campaignId` as send metadata without changing logical send keys. Charged
reservations retain it. Limit and spacing denials expose `blockingCampaignIds`, and persisted denial
evidence includes both the denied `campaignId` and the campaigns whose reservations blocked it.
