---
"@croco/metrics-core": patch
"@croco/problems-core": patch
---

Accept runtime-supported IANA time zone aliases in metric date buckets and compare date column zones by their resolved identity while preserving declared zone names. Reject missing or non-string zones instead of using the system default, and keep generated Problem source locations accurate.
