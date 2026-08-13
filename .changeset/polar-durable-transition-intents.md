---
"@croco/billing-core": major
"@croco/billing-polar": major
"@croco/problems-core": patch
---

Polar subscription webhooks now persist previous-state evidence and stable per-event delivery intents atomically with subscription transitions, so retries resume only unpublished events before completing the webhook.

Billing store adapters must implement the new subscription webhook transition and event-intent persistence methods.
Polar webhook event publishers must now provide idempotent delivery by stable event ID.
