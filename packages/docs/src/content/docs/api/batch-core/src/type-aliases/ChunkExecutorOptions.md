---
editUrl: false
next: false
prev: false
title: "ChunkExecutorOptions"
---

> **ChunkExecutorOptions** = `object`

## Properties

### completeExecution?

> `readonly` `optional` **completeExecution?**: `boolean`

Complete the execution after this step finishes.

Defaults to true for single-step batch jobs. Multi-step jobs should pass false
for intermediate steps and complete the parent execution after orchestration succeeds.

---

### startExecution?

> `readonly` `optional` **startExecution?**: `boolean`

Start the execution before processing the step.

Defaults to true. Multi-step jobs that keep the parent execution open with
completeExecution: false should pass false for later steps so the executor
reads the current running execution instead of attempting running -> running.
