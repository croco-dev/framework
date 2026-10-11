---
editUrl: false
next: false
prev: false
title: "LifecycleRunClaimResult"
---

> **LifecycleRunClaimResult** = \{ `claimed`: `true`; \} \| \{ `claimed`: `false`; `existingRun?`: [`LifecycleRun`](/api/lifecycle-core/src/type-aliases/lifecyclerun/); `reason`: `"cooldown_active"` \| `"idempotency_key_reused"`; \} \| \{ `claimed`: `false`; `existingRun`: [`LifecycleRun`](/api/lifecycle-core/src/type-aliases/lifecyclerun/); `reason`: `"source_payload_conflict"`; \}
