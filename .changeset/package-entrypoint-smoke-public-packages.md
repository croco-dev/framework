---
"@croco/entitlements-drizzle": patch
"@croco/auth-clerk": patch
"@croco/customer-health-drizzle": patch
"@croco/frontend-cloudflare": patch
"@croco/frontend-vite": patch
"@croco/invitation-drizzle": patch
"@croco/meta-vite": patch
"@croco/metering-drizzle": patch
"@croco/migration-runner": patch
"@croco/membership-drizzle": patch
"@croco/search-meilisearch": patch
"@croco/telemetry-sdk-node": patch
"@croco/transports-cloudflare-workers": patch
"@croco/transports-graphql": patch
---

Keep published package entrypoints importable by generating advertised declaration files, declaring public runtime and type dependencies on the install surface, deferring Clerk webhook peer loading until webhook handling is used, preserving concrete customer health injection tokens in built output, no longer advertising CommonJS entrypoints that cannot load ESM-only peers, and keeping the migration CLI parser behind binary execution.
