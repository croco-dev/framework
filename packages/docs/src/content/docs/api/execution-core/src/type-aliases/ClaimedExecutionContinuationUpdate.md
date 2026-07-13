---
editUrl: false
next: false
prev: false
title: "ClaimedExecutionContinuationUpdate"
---

> **ClaimedExecutionContinuationUpdate** = \{ `expiresAt`: `Date`; `kind`: `"renew"`; `now`: `Date`; `workerId`: `string`; \} \| \{ `checkpoints`: `Record`\<`string`, `unknown`\>; `kind`: `"stage"`; `nextToken`: `string`; \} \| \{ `kind`: `"confirm_publication"`; \} \| \{ `completedAt`: `Date`; `kind`: `"complete"`; `result?`: `unknown`; \} \| \{ `error`: [`ExecutionError`](/api/execution-core/src/interfaces/executionerror/); `failedAt`: `Date`; `kind`: `"fail"`; \}
