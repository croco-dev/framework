---
"@croco/triggers-qstash": patch
"@croco/problems-core": patch
---

Update existing QStash schedules when their destination differs from the configured webhook URL, including reporting destination changes during dry-run.

Keep the generated QStash invalid-sync-mode diagnostic source location aligned with the scheduler implementation.
