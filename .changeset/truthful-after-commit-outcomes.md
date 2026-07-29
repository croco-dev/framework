---
"@croco/tx-core": minor
"@croco/framework-context": minor
"@croco/events-core": minor
"@croco/invitation-core": minor
"@croco/testing": minor
"create-croco-app": patch
"@croco/problems-core": patch
---

Keep committed transaction values successful when after-commit hooks fail, and expose structured degraded delivery
evidence through `TxManager.runWithOutcome()`. Transactions that schedule after-commit work must now use this
outcome-returning contract; invitation acceptance returns the committed transaction outcome, and event publication
rejects non-capturing or late hook registration before delivery work can disappear.
