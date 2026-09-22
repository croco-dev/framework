---
"@croco/rpc-codegen": patch
"@croco/telemetry-api": patch
---

Generated RPC requests now propagate installed OpenTelemetry context without fabricating sampled
trace headers, support an opt-in bridge-owned CLIENT span lifecycle, and isolate telemetry failures
from business results. Existing fetch or HTTP instrumentation remains the default span owner and
receives the selected parent context without a duplicate bridge span.
