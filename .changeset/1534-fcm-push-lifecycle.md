---
"@croco/engagement-core": major
"@croco/engagement-drizzle": patch
"@croco/notifications-core": minor
"@croco/notifications-fcm": minor
"@croco/tasks-core": patch
"@croco/problems-core": patch
"create-croco-app": patch
---

Add Firebase Cloud Messaging push delivery with canonical content, bounded batch concurrency, sanitized failure classification, and explicit readiness diagnostics. Add scoped push endpoint registration, refresh, rotation, terminal invalidation, and application-triggered stale endpoint maintenance with durable delivery evidence.

Replaying a persisted dispatch reconciles acceptance and terminal token-invalid events after a delivery-event store outage without sending the notification again. If dispatch persistence failed, notification replay can recover an endpoint-invalidating outcome from the settled task's saved failure code when the provider declares that code. Endpoint refresh preserves the latest `lastSeenAt` value when registrations overlap, and stale cleanup rechecks its cutoff when invalidating.

Replace `PushEndpoint.token` with an opaque `tokenReference` and remove `PushTokenResolver` from `StoreBackedRecipientDirectory`. Applications must keep tokens in a vault and configure the `FcmProvider` option `resolveToken` so persisted notification jobs contain references only. FCM does not guarantee idempotency-key deduplication.

Contact-policy dispatches retain provider acceptance and terminal token-invalid evidence independently of unknown budget acceptance. Replay validates the payload and campaign before repairing events, preserves prior dispatch evidence when eligibility changes, and never resends or releases unknown budget automatically.
