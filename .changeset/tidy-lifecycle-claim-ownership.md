---
"@croco/lifecycle-core": patch
---

Preserve the original lifecycle dispatch claim when saving a duplicate result fails, so redelivery cannot execute the action again or prevent the original run from finalizing.
