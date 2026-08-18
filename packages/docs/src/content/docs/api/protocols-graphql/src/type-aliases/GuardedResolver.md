---
editUrl: false
next: false
prev: false
title: "GuardedResolver"
---

> **GuardedResolver**\<`TSource`, `TContext`, `TArgs`, `TReturn`\> = `object`

## Type Parameters

### TSource

`TSource` = `unknown`

### TContext

`TContext` *extends* `Record`\<`string`, `unknown`\> = `Record`\<`string`, `unknown`\>

### TArgs

`TArgs` = `Record`\<`string`, `unknown`\>

### TReturn

`TReturn` = `unknown`

## Properties

### guards

> **guards**: () => [`GraphQLGuard`](/api/protocols-graphql/src/type-aliases/graphqlguard/)[]

#### Returns

[`GraphQLGuard`](/api/protocols-graphql/src/type-aliases/graphqlguard/)

***

### resolver

> **resolver**: [`TypedResolver`](/api/protocols-graphql/src/type-aliases/typedresolver/)\<`TSource`, `TContext`, `TArgs`, `TReturn`\>
