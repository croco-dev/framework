---
"@croco/auth-better-auth": patch
---

Verify session ownership before requesting upstream session revocation. Reject mismatched or missing sessions and failed ownership lookups without sending a revocation request, while preserving revocation for the session owner.
