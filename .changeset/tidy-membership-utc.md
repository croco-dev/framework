---
"@croco/membership-drizzle": patch
---

Store membership timestamp defaults as UTC independently of the PostgreSQL session time zone, and preserve UTC timestamps returned by seat-limited inserts. Existing deployments can apply the exported timestamp-default migration without rewriting stored rows.
