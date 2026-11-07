---
"@croco/events-inmemory": patch
---

Keep Map, Set and cyclic event payloads isolated from publishers and other handlers with or without a dead-letter queue. Both modes preserve graph aliases and reject unsupported nested instances or executable values with UnsupportedDeadLetterValueProblem before delivery; applications passing those values without a queue must convert them to supported data before publishing.
