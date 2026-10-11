---
editUrl: false
next: false
prev: false
title: "RewardViewState"
---

> **RewardViewState**\<`T`\> = \{ `kind`: `"loading"` \| `"empty"`; \} \| \{ `kind`: `"denied"` \| `"error"`; `message`: `string`; `reload?`: () => `void`; \} \| \{ `kind`: `"partial"` \| `"ready"`; `message?`: `string`; `value`: `T`; \}

## Type Parameters

### T

`T`
