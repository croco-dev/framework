---
"@croco/ratelimit-upstash": patch
---

Keep fixed-window and token-bucket state and refund receipts in the same Redis Cluster slot so check and refund Lua scripts run without CROSSSLOT errors. Reset uses the same tagged keys, including when prefixes or caller keys contain braces or percent signs.

The new key format starts fresh quota and receipt state. Existing keys expire by their TTL; replace old instances together and finish outstanding refunds before switching. Sliding-window and standalone increment-counter keys are unchanged.
