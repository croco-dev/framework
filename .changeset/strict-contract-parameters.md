---
"@croco/protocols-rest": patch
---

Contract-bound `Param`, `Query`, and `Body` decorators now reject controller parameter annotations that cannot accept the parsed contract output, including `any` escape annotations, while preserving loose string/schema overloads and runtime metadata. Strict decorators require public, non-static, non-generic instance methods, and repository verification rejects overloaded decorated implementations whose annotations TypeScript hides.
