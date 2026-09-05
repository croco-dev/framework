---
"@croco/credits-drizzle": patch
---

Keep refunded credits spendable when their original grant lots have expired. Refund lots retain the earliest original expiry still in the future, or have no expiry when none remains, while preserving meter restrictions and allocation history.
