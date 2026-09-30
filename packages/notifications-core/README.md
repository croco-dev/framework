# @croco/notifications-core

Core notification delivery contracts for Croco applications.

`@croco/notifications-core` defines channel, payload, provider, service, and task
contracts for email, SMS, push, Slack, and in-app notification delivery. Providers
implement the shared interface while application code uses `NotificationService`.

## Public API

- `NotificationService` - registers providers and sends notifications.
- `NotificationPreferenceEvaluator` - resolves tenant, user, channel, and topic
  preference rules deterministically before dispatch.
- `NotificationTemplateRegistry` - registers versioned locale templates and
  validates variables before rendering.
- `SendNotificationTask` - task handler for retryable notification delivery.
- Dispatch helpers for idempotency keys, outbox references, and provider
  capability metadata.
- Notification channel, payload, provider, job, and result types.
- Notification Problems for provider and delivery failures.

Every provider must declare its complete capability profile. Registration rejects a profile whose
`providerName` differs from `getName()` or whose `channels` omit `getChannel()`. The registry retains the
validated profile for dispatch; it never infers template, idempotency, or outbox behavior. Provider integrations
can expose that same explicit profile through their diagnostics, and certification suites can inspect it through
`getCapabilities()`.

Providers may declare `terminalEndpointFailureCodes` for normalized failures that permanently
invalidate a destination endpoint. When an idempotent task replay returns a failed settled execution,
`NotificationService` compares its saved `failureCode` with that declaration. A match restores the
terminal endpoint-invalidating outcome so engagement can persist delivery evidence after a store
outage. This path uses the saved code and fixed text; it does not reconstruct the original error
message or stack. Declare only codes that require endpoint invalidation, not authentication or
payload errors.

```typescript
import { NotificationChannel, type NotificationProvider } from "@croco/notifications-core";

const provider: NotificationProvider = {
  getName: () => "example-email",
  getChannel: () => NotificationChannel.EMAIL,
  getCapabilities: () => ({
    providerName: "example-email",
    channels: [NotificationChannel.EMAIL],
    supportsIdempotencyKey: false,
    supportsProviderTemplates: false,
    supportsRenderedTemplates: true,
    outboxIntegration: "consumer-managed",
  }),
  send: async () => ({ success: true }),
};
```

## Usage

```typescript
import {
  createNotificationIdempotencyKey,
  NotificationChannel,
  NotificationService,
} from "@croco/notifications-core";

const preferenceContext = {
  tenantId: "tenant-1",
  userId: "user-1",
  channel: NotificationChannel.EMAIL,
  topic: "account.welcome",
};

await notificationService.send(
  NotificationChannel.EMAIL,
  {
    to: "user@example.com",
    subject: "Welcome",
    content: "Hello from Croco",
  },
  {
    idempotencyKey: createNotificationIdempotencyKey({
      ...preferenceContext,
      recipient: "user@example.com",
      semanticKey: "welcome-v1",
    }),
    preferenceContext,
  },
);
```

## Push content

`NotificationPayload.push` carries canonical `PushContent`: required `title` and `body`, plus
optional `deepLink`, `imageUrl`, string-valued `data`, `collapseKey`, `ttlSeconds`, and `priority`
(`"normal"` or `"high"`). The first-party [`@croco/notifications-fcm`](../notifications-fcm/README.md)
provider maps these fields to Firebase Admin requests. `content` remains required by the shared
payload contract; engagement dispatch fills it from the push body.

For durable push jobs, keep `to` as an opaque vault reference and resolve the token inside the
provider. Do not resolve tokens before serializing jobs, or put raw tokens in metadata or diagnostic
output. Provider acceptance does not establish device delivery, and a Croco idempotency key does
not imply provider deduplication: inspect `supportsIdempotencyKey` in the provider capability profile.

## Provider results

Providers return a discriminated `NotificationResult`. Successful delivery may include a provider message ID,
while failed delivery must include a Croco `Problem`. Provider-native responses remain available as optional
diagnostic evidence on either branch.

```typescript
import type { NotificationProvider, NotificationResult } from "@croco/notifications-core";

async function deliver(provider: NotificationProvider): Promise<NotificationResult> {
  const result = await provider.send({
    to: "user@example.com",
    content: "Hello from Croco",
  });

  if (!result.success) {
    throw result.problem;
  }

  return result;
}
```

## Verification

```bash
pnpm --filter @croco/notifications-core test
pnpm --filter @croco/notifications-core typecheck
```
