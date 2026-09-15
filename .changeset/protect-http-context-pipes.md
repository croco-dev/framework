---
"@croco/transports-http": patch
---

Preserve `@Ctx()` and `@Raw()` framework context parameters when HTTP pipes are active, and omit their non-executing pipe stages from request pipeline graphs.
