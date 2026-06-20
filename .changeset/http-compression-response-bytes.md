---
"@croco/transports-http": patch
---

HTTP compression middleware now returns encoded response bytes whenever it advertises `Content-Encoding`, while preserving threshold, content type, and error-response skip behavior.
