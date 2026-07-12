---
"@croco/framework-context": patch
"@croco/framework-module": patch
---

Reject ambiguous module provider ownership before shared container mutation, require lifecycle writes to use locally declared providers, and keep symbol provider identities consistent between module and context containers.
