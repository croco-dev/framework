---
"@croco/protocols-trpc": patch
"@croco/problems-core": patch
---

Run controller and method pipes on tRPC body, path, query, and header arguments inside the request lifecycle, preserving context arguments and reporting pipe failures through the existing Problem/filter pipeline.

Keep generated tRPC Problem diagnostic source locations synchronized with the pipe-enabled request lifecycle.
