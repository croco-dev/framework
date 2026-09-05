---
"@croco/auth-clerk": patch
---

Revoke only active Clerk sessions and continue bulk revocation when a listed session has already ended or disappeared, while preserving upstream failures that do not confirm session termination.
