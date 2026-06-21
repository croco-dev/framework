---
"@croco/framework-context": patch
"@croco/testing": patch
"@croco/transports-http": patch
"create-croco-app": patch
---

HTTP apps now expose a DI bootstrap validation policy that fails fast by default, with explicit warn/off migration modes for legacy unregistered providers.
