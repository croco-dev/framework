---
"@croco/billing-core": minor
"@croco/billing-polar": minor
"@croco/entitlements-drizzle": patch
"@croco/testing": minor
"@croco/problems-core": patch
"create-croco-app": patch
---

Persist subscription cancel and resume commands before provider I/O, carry stable provider idempotency keys,
use revision-fenced local reconciliation, durably retry cancellation event delivery through an
event-ID-idempotent publisher contract, expose bounded
reconciliation APIs, and project provider-applied lifecycle state into entitlement reads until local state
converges.

Stale commands cannot overwrite replacement subscriptions, while lifecycle deltas rebase onto newer snapshots
of the same external subscription and persist their local outcome. Canceled or revoked subscriptions no longer
grant a current entitlement plan. Polar lifecycle mutations now forward command keys and verify already-applied
cancellation targets, while the billing provider conformance suite requires distinct lifecycle idempotency
evidence.

The generated SaaS demo leaves lifecycle event delivery unconfigured until an application supplies a durable,
event-ID-idempotent publisher.
