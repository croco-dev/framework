---
"@croco/webhooks-core": patch
---

Outbound webhook URL validation rejects NAT64 and 6to4 addresses that embed blocked IPv4 targets, and rejects site-local IPv6 addresses.
