---
"@croco/warehouse-postgres": patch
---

Compare source coverage and aggregate partition bounds by time when sealing warehouse candidates. Equivalent timestamp offsets are accepted, and coverage with reversed or insufficient bounds is rejected before it is stored.
