---
"@croco/auth-better-auth": major
---

Require signed webhook timestamps and an idempotency store so verified Better Auth deliveries execute once, concurrent duplicates share the same reservation, and delivery ID reuse with a changed payload fails closed.
