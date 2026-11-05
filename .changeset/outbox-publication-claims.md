---
"@croco/events-tx": patch
---

Skip outbox publication when another relay has completed or superseded a waiting claim. Release expired unstarted claims without consuming an attempt, and honor cancellation while checking ownership. An ownership read failure releases unstarted claims where storage remains available and preserves the original error.
