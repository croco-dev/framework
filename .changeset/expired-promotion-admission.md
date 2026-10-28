---
"@croco/promotions-core": patch
"@croco/promotions-drizzle": patch
---

Expire overdue reserved promotion claims before starting credit grants or discount entitlements, with one transactional budget release and audit when fulfillment competes with the expiry sweep. Preserve recovery and receipt replay for grants already admitted before expiry.
