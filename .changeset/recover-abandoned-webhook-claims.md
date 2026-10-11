---
"@croco/webhooks-core": major
---

Outbound webhook deliveries can be reclaimed after a worker stops, while expired workers can no longer record or release a replacement worker's claim. Persistent store adapters must implement datastore-time leases and claim-token checks for attempts and releases.
