---
"@croco/billing-core": minor
---

Keep publication recovery evidence when cancelling a plan version that was already published or whose registry status cannot be confirmed. Serialize publish and cancellation per release through the required `PlanReleaseStore.withPublicationLock` contract; custom stores must coordinate every worker and fence lost lock owners. Registry adapters must provide authoritative absence and settle outstanding writes before cancellation can proceed. Retry the original publish command to recover an already-published release.
