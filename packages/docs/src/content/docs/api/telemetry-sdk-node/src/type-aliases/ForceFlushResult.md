---
editUrl: false
next: false
prev: false
title: "ForceFlushResult"
---

> **ForceFlushResult** = \{ `flushedSpans`: `-1`; `outcome`: `"completed"`; \} \| \{ `flushedSpans`: `0`; `outcome`: `"skipped"`; `reason`: [`TelemetryLifecycleSkipReason`](/api/telemetry-sdk-node/src/type-aliases/telemetrylifecycleskipreason/); \} \| \{ `flushedSpans`: `0`; `outcome`: `"unsupported"`; `reason`: `"not-initialized"`; \} \| \{ `error`: `TelemetryRuntimeProblem`; `flushedSpans`: `-1`; `outcome`: `"failed"`; \}
