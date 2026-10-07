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

The default `first-reachable` policy follows the message's declared channel order and dispatches every eligible endpoint in the first reachable channel. Later channels are skipped after that channel queues a send. Use `policy: "all-reachable"` to dispatch every eligible endpoint across all declared channels. Endpoint dispatch is sequential; a provider failure stops the send and preserves evidence for earlier accepted endpoints. Preference denial, suppression, and missing endpoints return explicit non-provider outcomes; recipient lookup, rendering, and provider failures remain typed Problems. `InMemoryRecipientDirectory` is intended for tests and single-process examples. Durable endpoints, preferences, and suppressions belong in storage-backed implementations.

Recipient directory, suppression evaluation, and persistence wrappers preserve the cause's explicit
retryability via `readExplicitRetryability`: a top-level boolean takes precedence over
`extensions.retryable`. Without an explicit boolean, these wrappers remain retryable. Dispatch
wrappers use the same explicit classification; an unclassified Problem remains non-retryable,
while an unclassified ordinary Error is retryable, matching campaign member failure classification.

Rendering failures remain non-retryable even when their cause requests retry: rendering is treated
as a message/template correction boundary, so repeating campaign delivery does not repair it.
A recorded failed dispatch also remains non-retryable on replay, independently of its provider's
retryability evidence, to avoid automatically resending a logical delivery with durable failure
or partial acceptance. Recover that dispatch through the owning notification/task workflow.

## Push endpoint lifecycle and delivery evidence

Keep raw device tokens in an application-owned vault. `tokenReference` must be an opaque identifier
that contains no token or credential: it appears in endpoint identities and persisted jobs.
`StoreBackedRecipientDirectory` takes a recipient directory and a `ContactEndpointStore`; it returns
active endpoint references without reading the vault. Configure
[`FcmProvider`](../notifications-fcm/README.md) with `resolveToken` to resolve each reference inside
the provider. Firebase credentials and SDK setup belong in the provider package and application.

```ts typecheck
import { PushEndpointLifecycle, type EngagementPersistence } from "@croco/engagement-core";

// Use a durable implementation, such as DrizzleEngagementStore, in the application.
declare const store: EngagementPersistence;
const lifecycle = new PushEndpointLifecycle(store);
const scope = {
  tenantId: "tenant-1",
  recipientId: "user-1",
  provider: "fcm",
  app: "customer-app",
  platform: "android",
  environment: "production",
};
const registered = await lifecycle.register({
  ...scope,
  tokenReference: "vault-device-reference-1",
  lastSeenAt: new Date(),
});
const rotated = await lifecycle.rotate({
  ...scope,
  previousEndpointId: registered.endpoint.id,
  expectedVersion: registered.endpoint.version,
  tokenReference: "vault-device-reference-2",
  lastSeenAt: new Date(),
});
```

Repeated registration with the same scope and reference refreshes `lastSeenAt` without duplicating
an active endpoint or moving the timestamp backward. A changed reference represents another endpoint;
use `rotate()` with the previous endpoint ID and current version to replace a device token atomically.
Rotation invalidates the previous endpoint, and stale versions fail. Registration cannot reactivate
an invalidated endpoint. Retain separate references for separate devices. The vault must resolve each
reference within its intended application, platform, and environment; endpoint metadata does not
select a Firebase project or provide provider failover.

Call `invalidateStale()` explicitly from application maintenance with a scope, `lastSeenBefore`, and
`invalidatedAt`. It invalidates active endpoints older than the cutoff; sends never delete endpoints
solely because of age. The store checks the cutoff when invalidating, so an endpoint refreshed past
the cutoff before that write stays active.

For durable policy and delivery evidence, use the same persistence implementation for the directory,
policy evaluator, dispatch store, and delivery-event processor:

```ts
import {
  EngagementDeliveryEventProcessor,
  StoreBackedRecipientDirectory,
  StoredEngagementPolicyEvaluator,
} from "@croco/engagement-core";

const events = new EngagementDeliveryEventProcessor(store);
const policy = new StoredEngagementPolicyEvaluator(store, store, {
  topicDefaults: { billing: "allow" },
});
const durableEngagement = new EngagementService(
  new StoreBackedRecipientDirectory(directory, store),
  new RegistryEngagementMessageRenderer(messageRegistry, rendererResolver),
  notificationService,
  policy,
  store,
  () => new Date(),
  undefined, // Optional contact policy gate.
  events,
);
```

Static notification preference rules veto dispatch first. The stored policy then checks active
suppressions, recipient preferences, tenant defaults, and configured topic/global defaults; absent
an explicit decision or default, it denies the send. Persisted dispatch targets retain execution IDs
and available provider message IDs. With the event processor configured, synchronous provider results
record acceptance and terminal token-invalid evidence; invalidation uses the dispatched endpoint
version, so a stale result cannot invalidate a newer endpoint version. An invalidated endpoint is excluded
from later recipient resolution. Acceptance proves only that the provider accepted the message.
Asynchronous dispatchers must feed their later results into the event processor themselves.

Store adapters must enforce `RecordEngagementDispatchInput.expectedState: "absent-or-eligibility"` atomically with the dispatch write. A queued or failed dispatch rejects that precondition without changing its targets or outcome. The exported store conformance suite checks this contract across reopened store handles.

The dispatch is persisted before its delivery events. If event persistence fails, the send fails;
retry the same message, recipient, and semantic key after the store recovers. Replay reconciles
acceptance events and any recorded terminal token-invalid outcome without another provider send.
When a contact policy gate is configured, replay validates its payload and campaign identity before repairing events. Provider acceptance and terminal token-invalid evidence remain separate from unknown contact-budget acceptance. A policy commit failure retains accepted target metadata and requires explicit budget reconciliation; replay never releases unknown budget or sends again. If current endpoint eligibility, preferences, suppression, preparation, or rendering prevents that validation, replay reports a policy conflict and preserves the original dispatch.

Event identities deduplicate events already written. A terminal provider failure remains a failure
after reconciliation, while its endpoint invalidation is completed. This recovery requires the
dispatch record or the underlying task result to be saved. If dispatch persistence failed after
a terminal task failure, notification replay recognizes the saved failure code when it appears
in the provider's `terminalEndpointFailureCodes`, then records the dispatch and invalidation.
FCM declares `notifications-fcm/token-invalid`. Recovery uses the normalized code without
reconstructing the original error message or stack.

`EngagementDeliveryEventProcessor.process()` also accepts provider-neutral `opened` and `clicked`
events from application-owned ingestion. Authenticate the caller, establish tenant/dispatch/endpoint
correlation, and map the interaction to a stable `providerEventId` before calling it. Reusing that event
identity deduplicates ingestion. Only allowlisted, bounded evidence is persisted; never include raw
client payloads or device tokens. This seam does not provide a mobile SDK or attribution analytics.
See the FCM README for credential-free tests and the explicitly opted-in live smoke procedure.

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

```typescript typecheck
import { ContactPolicy, InMemoryContactPolicyStore } from "@croco/engagement-core";

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

## User-owned weekly reminders

`ReminderService` provides explicit user create/update/snooze/cancel commands, read-only
`list`/`history`, `dueOccurrences`, `runDue`, and evidence-backed `reconcile`. Every command
requires app/environment/tenant, a verified subject, actor/reason, server authorization, and
mutations require an idempotency key. Create/update/snooze require the subject's own request;
operators cannot enable a canceled reminder. The application validates resource ownership
and registered topic/channel choices with `validateInput`.

`nextOccurrence(schedule, timezone, referenceTime)` is pure and returns the first weekly
instant strictly after the reference. Weekdays use Sunday=0. IANA zones are required. DST
gaps advance to the next valid minute; folds use their first instant once. The host's IANA
timezone database determines historical rules. Late delivery requires an explicit nonnegative
`lateDeliveryMs`; zero is the default policy choice. `skip_missed` expires overdue occurrences
and advances directly to the next future schedule, without sending a backlog.

Snooze changes one next occurrence; the weekly schedule remains unchanged. Update, timezone
change, snooze and cancel increment the version and invalidate pending/claimed occurrences.
The store serializes a subject's mutations and dispatch admission. `runDue` rechecks the
version, cancellation, deadline and application resource predicate before durably recording
`unknown`. That committed transition is the admission boundary. Cancellation completed before
admission prevents dispatch; after admission it cannot promise recall. Already queued messages
remain queued. Admission happens before invoking the external engagement sender. Provider or
storage failures after admission retain unknown acceptance and require reconciliation; restart
never automatically resends unknown occurrences. Reconciliation records actor/reason/evidence.

`createReminderEngagementSender(engagement, bindings)` uses the existing EngagementService
recipient, preference, suppression, rendering and notification path. Register one message
channel per topic/channel binding; the application owns service/marketing classification.
Reminder rows contain resource references, not endpoint addresses or tokens.

See [`examples/user-reminders`](../../examples/user-reminders/README.md) for PostgreSQL,
user/operator screens, an existing Cron trigger bridge and a CLI tick. The in-memory store
is a development/test adapter; deployment migration and subject inventory belong to the host.
