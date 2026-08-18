---
"@croco/rpc-codegen": patch
---

Escape static and parameterized route paths through a single TypeScript string encoder so generated client code stays syntactically valid for paths containing apostrophes, backslashes, backticks, CR/LF, and Unicode line separators.
