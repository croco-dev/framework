---
"@croco/events-core": patch
---

Event diagnostics report unhealthy until a bus is configured and every registered subscription has started. Failed startup and bus replacement remain unhealthy until subscriptions start successfully; existing publish counts and missing-stats diagnostics are preserved. EventBusConfig.isStarted exposes the same registration readiness without probing the transport.
