---
"@croco/customer-health-core": patch
"@croco/customer-health-drizzle": patch
"@croco/problems-core": patch
---

Reject non-finite and out-of-range health score, weight, threshold, usage, and limit inputs with stable Problems before they affect status, trend, or persistence decisions.
