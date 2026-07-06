---
"@croco/diagnostics-core": patch
"@croco/protocols-rest": patch
"@croco/transports-http": patch
---

Exception filter outcomes are now an explicit HTTP contract, and failed or invalid filter handling emits stable `CROCO_HTTP_FILTER_001` diagnostic evidence while preserving the original route error.
