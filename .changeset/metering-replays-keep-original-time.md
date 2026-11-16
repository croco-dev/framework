---
"@croco/metering-core": patch
"create-croco-app": patch
---

Keep the original usage record and UTC billing month when retrying an interrupted metering write, including in generated SaaS apps. Legacy processing receipts without an original record remain persistence-uncertain.
