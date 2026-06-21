# @croco/notifications-core

Core notification delivery contracts for Croco applications.

`@croco/notifications-core` defines channel, payload, provider, service, and task
contracts for email, SMS, push, Slack, and in-app notification delivery. Providers
implement the shared interface while application code uses `NotificationService`.

## Public API

- `NotificationService` - registers providers and sends notifications.
- `SendNotificationTask` - task handler for retryable notification delivery.
- Notification channel, payload, provider, job, and result types.
- Notification Problems for provider and delivery failures.

## Usage

```typescript
import { NotificationChannel, NotificationService } from "@croco/notifications-core";

await notificationService.send(NotificationChannel.EMAIL, {
  to: "user@example.com",
  subject: "Welcome",
  content: "Hello from Croco",
});
```

## Verification

```bash
pnpm --filter @croco/notifications-core test
pnpm --filter @croco/notifications-core typecheck
```
