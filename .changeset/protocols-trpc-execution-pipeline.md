---
"@croco/protocols-trpc": patch
"@croco/problems-core": patch
---

tRPC procedures now execute declared Croco guards, interceptors, and filters, and expose redacted Problem details with stable Croco code and status fields. The Problem registry now includes the tRPC guard-denial code.
