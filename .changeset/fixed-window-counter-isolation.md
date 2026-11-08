---
"@croco/ratelimit-core": patch
---

Keep fixed-window counters independent from request quota and refund receipts, preserving counter values and TTL across admission, refunds and window rollover. Explicit reset continues to clear both states.
