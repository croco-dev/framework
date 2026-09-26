---
"@croco/metrics-core": patch
"@croco/metrics-billing": patch
---

Monthly MRR now rounds each subscription to a whole minor unit, with exact halves rounded away from zero. Snapshot totals and billing movements use the same rounded amounts, so fractional plan rates can be stored in integer metrics columns.
