---
editUrl: false
next: false
prev: false
title: "createCursorPage"
---

## Call Signature

> **createCursorPage**\<`T`\>(`items`, `options`): [`CursorPageFull`](/api/pagination-core/src/type-aliases/cursorpagefull/)\<`T`\>

Create a cursor-based page result

Algorithm:
1. If items.length > limit: slice to limit, hasMore=true, nextCursor=encode(lastItem.id)
2. If items.length <= limit: keep all, hasMore=false, nextCursor=null
3. If hasPrevious/prevCursor provided, return CursorPageFull

### Type Parameters

#### T

`T`

### Parameters

#### items

`T`[]

#### options

`CursorPageWithHasPreviousOptions`\<`T`\>

### Returns

[`CursorPageFull`](/api/pagination-core/src/type-aliases/cursorpagefull/)\<`T`\>

## Call Signature

> **createCursorPage**\<`T`\>(`items`, `options`): [`CursorPageFull`](/api/pagination-core/src/type-aliases/cursorpagefull/)\<`T`\>

Create a cursor-based page result

Algorithm:
1. If items.length > limit: slice to limit, hasMore=true, nextCursor=encode(lastItem.id)
2. If items.length <= limit: keep all, hasMore=false, nextCursor=null
3. If hasPrevious/prevCursor provided, return CursorPageFull

### Type Parameters

#### T

`T`

### Parameters

#### items

`T`[]

#### options

`CursorPageWithPrevCursorOptions`\<`T`\>

### Returns

[`CursorPageFull`](/api/pagination-core/src/type-aliases/cursorpagefull/)\<`T`\>

## Call Signature

> **createCursorPage**\<`T`\>(`items`, `options`): [`CursorPage`](/api/pagination-core/src/type-aliases/cursorpage/)\<`T`\>

Create a cursor-based page result

Algorithm:
1. If items.length > limit: slice to limit, hasMore=true, nextCursor=encode(lastItem.id)
2. If items.length <= limit: keep all, hasMore=false, nextCursor=null
3. If hasPrevious/prevCursor provided, return CursorPageFull

### Type Parameters

#### T

`T`

### Parameters

#### items

`T`[]

#### options

[`CreateCursorPageOptions`](/api/pagination-core/src/type-aliases/createcursorpageoptions/)\<`T`\>

### Returns

[`CursorPage`](/api/pagination-core/src/type-aliases/cursorpage/)\<`T`\>
