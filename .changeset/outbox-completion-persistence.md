---
"@croco/events-tx": patch
---

Keep successfully delivered outbox messages in their publishing lease when completion persistence fails, and reject the batch with the original storage error instead of scheduling a publish retry or invoking dead-letter handling. Release unstarted batch claims without consuming attempts; failed releases retain lease recovery and do not replace the original error.
