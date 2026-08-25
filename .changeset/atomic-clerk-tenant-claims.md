---
"@croco/auth-clerk": minor
"@croco/problems-core": minor
---

Keep the first Clerk organization tenant claim authoritative under concurrent registration. Custom
`TenantMappingStore` adapters must replace `set()` with an atomic create-if-absent `claim()` and can
verify separate clients against the shared conformance suite.
