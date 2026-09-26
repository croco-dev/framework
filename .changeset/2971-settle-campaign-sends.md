---
"@croco/engagement-core": patch
"@croco/problems-core": patch
---

Failed campaign broadcast attempts wait for in-flight member sends before retrying and stop dispatching new members after the first failure. Problem Registry source locations point to the current campaign implementation.
