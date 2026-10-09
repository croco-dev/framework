---
"@croco/telemetry-sdk-node": patch
---

Lambda auto-instrumentation defaults now enable only HTTP/HTTPS and AWS SDK instrumentation. Explicit `aws-lambda` selection fails before SDK startup because module-scope initialization cannot wrap an already loaded handler; excluding it remains supported.
