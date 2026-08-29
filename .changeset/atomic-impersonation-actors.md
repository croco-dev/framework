---
"@croco/impersonation-core": major
---

Create impersonation sessions through an atomic actor claim so concurrent starts for one actor produce exactly one active session, while expired sessions can be replaced safely. Custom stores must replace `save()` with `commitStart()`, atomically persist its event intent, prevent session ID reuse, and enforce the actor claim with a uniqueness constraint or equivalent compare-and-set.
