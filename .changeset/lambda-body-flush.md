---
"@croco/transports-http": patch
---

Complete Lambda response body and header conversion before the final flush boundary so body-registered waitUntil tasks are joined and body read errors retain their causes alongside flush failures.
