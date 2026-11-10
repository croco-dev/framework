---
"@croco/etl-core": patch
---

Decode CSV and JSONL input without per-character asynchronous iteration or UTF-8 byte-buffer allocation, preserving source positions and limits for large pipeline batches.
