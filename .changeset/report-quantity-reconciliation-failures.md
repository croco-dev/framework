---
"@croco/billing-core": patch
---

Report retrying and non-retryable subscription quantity reconciliation failures in the in-memory store's diagnostics. Retrying intents also contribute to the oldest pending timestamp. Custom stores can report the new counters as they adopt the updated diagnostics contract.
