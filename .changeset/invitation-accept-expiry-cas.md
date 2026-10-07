---
"@croco/invitation-core": patch
---

Mark expired invitations through a conditional pending-to-expired transition so an invitation accepted concurrently keeps its accepted status and the late accept request fails without overwriting it.
