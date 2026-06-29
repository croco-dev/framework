---
editUrl: false
next: false
prev: false
title: "JobDetails"
---

> **JobDetails** = [`JobSummary`](/api/execution-core/src/type-aliases/jobsummary/) & `object`

## Type Declaration

### checkpoints?

> `readonly` `optional` **checkpoints?**: `Record`\<`string`, `unknown`\>

### error?

> `readonly` `optional` **error?**: [`ExecutionError`](/api/execution-core/src/interfaces/executionerror/)

### logs

> `readonly` **logs**: readonly [`ExecutionLogEntry`](/api/execution-core/src/interfaces/executionlogentry/)[]

### metadata?

> `readonly` `optional` **metadata?**: `Record`\<`string`, `unknown`\>

### payload?

> `readonly` `optional` **payload?**: `unknown`

### progress?

> `readonly` `optional` **progress?**: [`ProgressInfo`](/api/execution-core/src/interfaces/progressinfo/)

### result?

> `readonly` `optional` **result?**: `unknown`
