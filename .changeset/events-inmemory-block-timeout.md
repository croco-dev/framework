---
"@croco/events-inmemory": patch
---

Bound the default `block` backpressure wait so saturated in-memory event buses reject instead of leaving publishers pending forever.
