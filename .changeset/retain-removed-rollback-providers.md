---
"@croco/framework-context": patch
"@croco/problems-core": patch
---

Removing a provider or generated graph during a rollback-protected operation keeps existing instances alive until commit. A failed application startup can restore the same usable providers on retry.

The Problem registry points to the current source locations for the affected container diagnostics.
