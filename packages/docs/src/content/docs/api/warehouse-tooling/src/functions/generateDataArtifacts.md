---
editUrl: false
next: false
prev: false
title: "generateDataArtifacts"
---

> **generateDataArtifacts**\<`T`\>(`outputDirectory`, `compilation`, `options`): `Promise`\<`T`\>

Commits a complete generated directory while retaining unowned files and immutable migrations.

## Type Parameters

### T

`T`

## Parameters

### outputDirectory

`string`

### compilation

#### files

`Readonly`\<`Record`\<`string`, `string`\>\>

#### manifest

`T`

### options

#### migrationId

`string`

## Returns

`Promise`\<`T`\>
