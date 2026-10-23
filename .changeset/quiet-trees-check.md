---
"@croco/cli": patch
---

Reject malformed health, readiness and diagnostics response payloads in ops status and ops check so HTTP 200 fallback pages cannot report a healthy application.
