---
"@croco/problems-core": patch
"@croco/telemetry-sdk-node": patch
"create-croco-app": patch
---

Bound concurrent telemetry shutdown calls, let timed-out callers rejoin the same teardown, safely reinitialize only after OpenTelemetry global state is released, and keep generated operational failure drills explicit about their telemetry lifecycle.
