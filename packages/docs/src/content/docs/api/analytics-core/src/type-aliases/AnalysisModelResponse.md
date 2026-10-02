---
editUrl: false
next: false
prev: false
title: "AnalysisModelResponse"
---

> **AnalysisModelResponse** = `object`

## Properties

### cause?

> `readonly` `optional` **cause?**: `Error`

Server-only diagnostic cause. Never copied into an answer, receipt, or public Problem.

---

### completion

> `readonly` **completion**: `"complete"` \| `"truncated"` \| `"refused"` \| `"failed"` \| `"cancelled"`

---

### json

> `readonly` **json**: `string`

---

### usage

> `readonly` **usage**: [`AnalysisUsage`](/api/analytics-core/src/type-aliases/analysisusage/)
