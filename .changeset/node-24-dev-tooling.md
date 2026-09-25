---
"@croco/access-drizzle": patch
"@croco/architecture-policy": patch
"@croco/audit-drizzle": patch
"@croco/auth-drizzle": patch
"@croco/cli": patch
"@croco/framework-logger": patch
"@croco/metering-drizzle": patch
"@croco/migration-runner": patch
"@croco/repository-core": patch
"@croco/search-drizzle": patch
"@croco/search-meilisearch": patch
"@croco/storage-r2": patch
"@croco/tx-drizzle": patch
---

Build and test these packages against Node.js 24: development dependencies now use `@types/node` `^24`, and SQLite
test suites use `better-sqlite3` `^12.11.1`, which ships Node.js 24 prebuilt binaries. Runtime code and published
entrypoints are unchanged.
