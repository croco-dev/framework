---
"@croco/customer-health-core": patch
---

Return the committed newer health score when an older calculation loses a CAS race, without persisting stale transitions or publishing their events.
