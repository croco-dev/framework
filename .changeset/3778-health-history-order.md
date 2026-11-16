---
"@croco/customer-health-core": patch
"@croco/customer-health-drizzle": patch
---

Use committed transition order to resolve tied timestamps in health score history and trends. Return no trend when a legacy timestamp has conflicting endpoint scores and their order cannot be determined.
