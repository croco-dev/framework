---
"@croco/framework-routes": patch
---

Reject route registration tables whose HTTP method, paths, or controller/handler bindings differ from the supplied ContractGraph, with field-level drift diagnostics and source locations. Preserve legacy v1 path normalization when contractPath is omitted.
