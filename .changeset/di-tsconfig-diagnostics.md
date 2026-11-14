---
"@croco/esbuild-plugin": patch
---

Fail DI generation when TypeScript cannot parse the selected configuration, resolve its inheritance, or read its compiler options. The build error includes the TypeScript diagnostic code and configuration location.
