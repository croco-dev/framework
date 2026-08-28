---
"@croco/audit-core": minor
---

Select audited resource IDs and payloads by validated parameter indexes so reordered and optional handler arguments cannot be misattributed.

Replace `resourceIdParam` and `payloadParam` with `resourceIdIndex` and `payloadIndex`. Existing first/second-argument selections migrate to indexes `0` and `1`.

Indexes may select fixed and optional parameters before the first default or rest parameter. A selected default or rest parameter must first become fixed or optional; later parameters must move ahead of that boundary before selection.
When composing method decorators, place `@Auditable` closest to the method so it can validate the original parameter boundary.
