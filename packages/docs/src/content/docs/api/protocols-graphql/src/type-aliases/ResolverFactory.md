---
editUrl: false
next: false
prev: false
title: "ResolverFactory"
---

> **ResolverFactory**\<`TSource`, `TContext`, `TArgs`, `TReturn`\> = (`data`) => [`TypedResolver`](/api/protocols-graphql/src/type-aliases/typedresolver/)\<`TSource`, `TContext`, `TArgs`, `TReturn`\>

## Type Parameters

### TSource

`TSource` = `unknown`

### TContext

`TContext` _extends_ `Record`\<`string`, `unknown`\> = `Record`\<`string`, `unknown`\>

### TArgs

`TArgs` = `Record`\<`string`, `unknown`\>

### TReturn

`TReturn` = `unknown`

## Parameters

### data

[`ResolverData`](/api/protocols-graphql/src/interfaces/resolverdata/)\<`TContext`\>

## Returns

[`TypedResolver`](/api/protocols-graphql/src/type-aliases/typedresolver/)\<`TSource`, `TContext`, `TArgs`, `TReturn`\>
