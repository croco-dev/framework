---
"@croco/webhooks-core": patch
---

Preserve retry classification from ordinary Error causes when webhook handlers or unknown-event reporters fail. Non-retryable SDK errors remain failed on redelivery, while unclassified errors continue to retry.
