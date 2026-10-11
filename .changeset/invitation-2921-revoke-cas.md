---
"@croco/invitation-core": patch
"@croco/invitation-drizzle": patch
---

Revoke pending invitations through a conditional pending-to-revoked transition so a concurrent accept is no longer overwritten. A losing revoke now fails with INVITATION_INVALID_STATUS, keeps the accepted invitation, and skips the revoke event. Revoking a declined invitation is rejected without changes, and resending one surfaces the revoke conflict instead of issuing a replacement.
