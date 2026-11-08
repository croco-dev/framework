---
"@croco/metering-core": patch
"@croco/metering-drizzle": patch
"@croco/problems-core": patch
---

Keep registered quota and billing policies isolated from mutations to repository inputs and registry snapshots, including nested metadata and dates. Meter definition metadata now accepts only JSON data and valid Date values; previously accepted executable or opaque values are rejected with `metering/invalid-meter-metadata` before persistence or cache installation. Drizzle reads reject malformed or unsupported stored metadata instead of silently dropping it. Existing callers and stored data must be checked against the documented compatibility requirements.
