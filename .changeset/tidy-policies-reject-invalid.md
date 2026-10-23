---
"@croco/architecture-policy": patch
"@croco/problems-core": patch
---

Reject malformed architecture policy fields before normalization so invalid ignore selectors cannot exempt every private import and invalid rules cannot disappear silently.

Keep generated Problem source locations aligned with the policy diagnostics.
