---
editUrl: false
next: false
prev: false
title: "DetailedEvaluation"
---

> **DetailedEvaluation**\<`T`\> = \{ `appRevision`: `string`; `providerMetadata?`: `Readonly`\<`Record`\<`string`, `string`\>\>; `reason`: `string`; `status`: `"evaluated"`; `value`: `T`; \} \| \{ `providerMetadata?`: `Readonly`\<`Record`\<`string`, `string`\>\>; `reason`: `string`; `status`: `"unavailable"` \| `"evaluation_failed"` \| `"not_assigned"`; \}

## Type Parameters

### T

`T` = `string` \| `boolean` \| `number`
