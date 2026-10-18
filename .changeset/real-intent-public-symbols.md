---
'@croco/framework-routes': patch
---

Derive intent map public symbols from TypeScript export declarations so comments, string values, and nested declarations do not publish phantom APIs. Preserve named exports and source locations, including all bindings in exported variable declarations.
