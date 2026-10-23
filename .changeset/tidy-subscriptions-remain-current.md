---
"@croco/billing-core": patch
"@croco/billing-drizzle": patch
---

Preserve the current subscription when delayed webhooks target an external subscription that was already replaced. PostgreSQL installations must apply the additive `0002_subscription_replacements` migration before upgrading the adapter.
