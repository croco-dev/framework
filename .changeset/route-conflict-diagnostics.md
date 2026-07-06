---
"@croco/transports-http": patch
---

Duplicate route diagnostics now identify both conflicting controller methods and route decorator source locations.
The `transports-http/duplicate-route-definition` recovery metadata now marks route conflicts as not retryable until one route decorator is changed.
