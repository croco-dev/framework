---
"@croco/protocols-rest": patch
"@croco/auth-core": patch
---

Keep inherited REST and auth parameter metadata isolated per controller so decorating one subclass no longer changes its base controller or sibling subclasses.
