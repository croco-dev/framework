---
"@croco/webhooks-core": patch
---

Keep outbound webhook retry schedules consistent by rejecting invalid retry timing and clearing
scheduled attempts when deliveries become terminal.
