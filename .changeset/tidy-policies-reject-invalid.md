---
"@croco/architecture-policy": patch
---

Reject malformed architecture policy fields before normalization so invalid ignore selectors cannot exempt every private import and invalid rules cannot disappear silently.
