---
"@croco/impersonation-core": major
"@croco/problems-core": patch
---

Persist impersonation lifecycle event intents atomically with session start and end transitions, preserve per-session delivery order across replay, expose pending-event diagnostics, and require lifecycle event publishers to deduplicate by stable event identity.

Custom impersonation stores must implement the new atomic transition and ordered event-intent methods. Applications must provide an `ImpersonationLifecycleEventPublisher` when constructing `ImpersonationService`.
