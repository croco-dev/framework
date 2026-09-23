---
"@croco/transports-http": patch
"@croco/diagnostics-core": patch
"@croco/problems-core": patch
---

- Record handled HTTP 5xx errors in diagnostics history while excluding 4xx responses, expose their stable diagnostic code, and keep the generated Problem registry aligned.
