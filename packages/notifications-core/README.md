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

## Verification

```bash
pnpm --filter @croco/notifications-core test
pnpm --filter @croco/notifications-core typecheck
```
