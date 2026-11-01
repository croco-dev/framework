---
"@croco/framework-context": patch
---

Reject shutdown timeouts outside the integer range 1–2,147,483,647ms before creating or reconfiguring a manager. Invalid configuration preserves registered hooks and the existing timeout instead of allowing Node timer overflow to abort shutdown immediately.
