---
"@croco/transports-http": patch
---

Preserve completed HTTP responses and original handler errors when rate-limit quota refunds fail, with separate refund failure diagnostics and pre-handler validation for missing refund receipts.
