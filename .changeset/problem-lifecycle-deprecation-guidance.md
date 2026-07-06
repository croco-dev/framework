---
"@croco/problems-core": patch
---

Require deprecated Problem registry entries to include a deprecation reason, migration guidance, and either an active replacement Problem code or an explicit no-replacement reason. Registry checks now fail incomplete lifecycle metadata, and generated recovery cookbook entries surface no-replacement guidance for deprecated Problem codes.
