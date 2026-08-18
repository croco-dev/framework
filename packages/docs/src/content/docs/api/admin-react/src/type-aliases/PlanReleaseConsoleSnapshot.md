---
editUrl: false
next: false
prev: false
title: "PlanReleaseConsoleSnapshot"
---

> **PlanReleaseConsoleSnapshot** = `object`

## Properties

### candidate

> `readonly` **candidate**: [`PlanReleaseDraft`](/api/admin-react/src/type-aliases/planreleasedraft/)

---

### currentPublished

> `readonly` **currentPublished**: [`PlanVersionDefinition`](/api/billing-core/src/type-aliases/planversiondefinition/) \| `null`

---

### releaseRevision

> `readonly` **releaseRevision**: `number`

Optimistic-concurrency revision used by billing-core transition commands.
