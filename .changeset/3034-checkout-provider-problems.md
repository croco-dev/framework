---
"@croco/billing-core": patch
"@croco/problems-core": patch
---

Checkout callers receive provider 4xx Problems unchanged. Other provider failures retain their cause and retryability when reported as checkout creation failures. The Problem registry points to the updated billing source locations.
