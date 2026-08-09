---
"@croco/preset-node": patch
"@croco/problems-core": patch
---

Make Node entry startup and shutdown linearizable so concurrent lifecycle calls cannot leak server listeners.
