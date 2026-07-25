---
"@croco/membership-core": patch
---

Defer ownership transfer events until an ambient transaction commits, while continuing to publish immediately when
the transfer store operation commits independently.
