---
editUrl: false
next: false
prev: false
title: "TypedResolver"
---

> **TypedResolver**\<`TSource`, `TContext`, `TArgs`, `TReturn`\> = (`source`, `args`, `context`, `info`) => `Promise`\<`TReturn`\> \| `TReturn`

## Type Parameters

### TSource

`TSource` = `unknown`

### TContext

`TContext` *extends* `Record`\<`string`, `unknown`\> = `Record`\<`string`, `unknown`\>

### TArgs

`TArgs` = `Record`\<`string`, `unknown`\>

### TReturn

`TReturn` = `unknown`

## Parameters

### source

`TSource`

### args

`TArgs`

### context

`TContext`

### info

`unknown`

## Returns

`Promise`\<`TReturn`\> \| `TReturn`
