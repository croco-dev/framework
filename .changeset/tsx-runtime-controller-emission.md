---
"@croco/protocol-codegen": patch
"@croco/problems-core": patch
---

Load TSX controllers and helpers in JSX-preserving projects by transforming temporary runtime output to JavaScript while preserving application analysis options. Use actual TypeScript output paths for imports, aliases, and module boundaries.

Include temporary JSX runtime validation failures in generated Problem metadata and recovery guidance.
