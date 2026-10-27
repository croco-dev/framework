---
"@croco/framework-context": minor
"@croco/transports-http": patch
"@croco/problems-core": patch
---

Keep HTTP request providers alive through response body consumption and release them on completion, cancellation, failure, or abort. Hosts can explicitly own a request scope without changing Context.run callback cleanup.
