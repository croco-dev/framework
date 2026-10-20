---
editUrl: false
next: false
prev: false
title: "S3ReadOptions"
---

> **S3ReadOptions** = [`StorageOperationOptions`](/api/storage-core/src/type-aliases/storageoperationoptions/) & `object`

## Type Declaration

### range?

> `readonly` `optional` **range?**: `object`

Inclusive byte offsets; invalid ranges are rejected before I/O.

#### range.end?

> `readonly` `optional` **end?**: `number`

#### range.start

> `readonly` **start**: `number`
