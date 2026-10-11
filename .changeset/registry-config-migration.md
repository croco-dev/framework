---
"@croco/esbuild-plugin": patch
---

Reject unsupported generateRegistry configuration with an explicit migration diagnostic instead of silently ignoring it. Use di.enabled and di.outFile for generated application graphs, including output next to component sources.
