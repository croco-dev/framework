---
"@croco/access-core": patch
"@croco/access-drizzle": patch
"@croco/problems-core": patch
"create-croco-app": patch
---

Make access decisions authoritative and statically consistent: allow results always carry
`allowed: true`, while deny and abstain results always carry `allowed: false` across the engine,
Drizzle provider, guards, and generated SaaS provider.
