---
editUrl: false
next: false
prev: false
title: "QStashStep"
---

> **QStashStep**\<`I`, `O`\> = `Omit`\<[`Step`](/api/batch-core/src/classes/step/)\<`I`, `O`\>, `"reader"` \| `"writer"`\> & `object`

## Type Declaration

### reader

> **reader**: [`ItemReader`](/api/batch-core/src/interfaces/itemreader/)\<`I`\> & [`Checkpointable`](/api/batch-core/src/interfaces/checkpointable/)

### writer

> **writer**: [`ItemWriter`](/api/batch-core/src/interfaces/itemwriter/)\<`O`\> & [`QStashIdempotentWriter`](/api/batch-qstash/src/interfaces/qstashidempotentwriter/)\<`O`\>

## Type Parameters

### I

`I`

### O

`O`
