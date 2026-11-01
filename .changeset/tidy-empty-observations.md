---
"@croco/testing": patch
---

Accept empty no-output success responses in contract fuzzing and runtime differential assertions, using the existing default 204 status while preserving declared statuses, output-schema validation and invalid-input rejection. Executors represent an absent response body as `undefined`; JSON `null` remains a body.
