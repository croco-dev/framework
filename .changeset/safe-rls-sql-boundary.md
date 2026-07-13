---
"@croco/tx-drizzle": patch
---

Validate every PostgreSQL RLS identifier and setting key before execution, render policy SQL through Drizzle's PostgreSQL dialect, parameterize transaction-local tenant settings, and expose value-redacted configuration Problems.
