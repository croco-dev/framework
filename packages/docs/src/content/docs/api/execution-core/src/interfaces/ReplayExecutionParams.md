---
editUrl: false
next: false
prev: false
title: "ReplayExecutionParams"
---

Parameters for replaying a failed execution.

## Properties

### metadata?

> `optional` **metadata?**: `Record`\<`string`, `unknown`\>

Optional metadata merged before system replay metadata

***

### payload?

> `optional` **payload?**: `unknown`

Optional payload override. Defaults to the original execution payload.

***

### reason?

> `optional` **reason?**: `string`

Optional replay reason stored in metadata and initial log entry
