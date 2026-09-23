---
editUrl: false
next: false
prev: false
title: "HealthTransitionCommitResult"
---

> **HealthTransitionCommitResult** = \{ `committed`: `true`; `eventPublicationDeferred?`: `true`; \} \| \{ `committed`: `false`; `latest`: [`TenantHealthScore`](/api/customer-health-core/src/type-aliases/tenanthealthscore/) \| `null`; \}

## Union Members

### Type Literal

\{ `committed`: `true`; `eventPublicationDeferred?`: `true`; \}

#### committed

> `readonly` **committed**: `true`

#### eventPublicationDeferred?

> `readonly` `optional` **eventPublicationDeferred?**: `true`

The transition joined a caller-owned transaction and its events must remain pending.

---

### Type Literal

\{ `committed`: `false`; `latest`: [`TenantHealthScore`](/api/customer-health-core/src/type-aliases/tenanthealthscore/) \| `null`; \}
