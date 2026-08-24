---
"@croco/notifications-core": minor
"@croco/notifications-resend": minor
"@croco/tasks-core": patch
---

Notification providers now return structurally coherent delivery results: successful outcomes may carry delivery
evidence, while failures must carry a Croco Problem that drives retry classification. The Resend adapter normalizes
all provider failures into that Problem contract before returning, replacing the legacy failure `error` field with
`problem`. Task execution now preserves retryability declared by Croco Problem extensions.
