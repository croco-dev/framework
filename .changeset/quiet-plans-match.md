---
"@croco/entitlements-core": patch
"@croco/entitlements-drizzle": patch
---

Reject legacy plan version references that disagree with the expected plan ID in the base and Drizzle entitlement registries. Matching references and lookups without an expected plan retain the existing legacy fallback.
