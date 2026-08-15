---
"@croco/customer-health-drizzle": patch
---

Persist current and previous fractional health scores without integer truncation, and export the
PostgreSQL migration that widens existing score columns while preserving integer rows.
