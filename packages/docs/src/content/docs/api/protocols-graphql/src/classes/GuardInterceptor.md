---
editUrl: false
next: false
prev: false
title: "GuardInterceptor"
---

## Implements

- [`GraphQLInterceptor`](/api/protocols-graphql/src/interfaces/graphqlinterceptor/)

## Constructors

### Constructor

> **new GuardInterceptor**(`guards`): `GuardInterceptor`

#### Parameters

##### guards

[`Guard`](/api/framework-context/src/interfaces/guard/)\<[`GraphQLInterceptorContext`](/api/protocols-graphql/src/type-aliases/graphqlinterceptorcontext/)\>[]

#### Returns

`GuardInterceptor`

## Methods

### intercept()

> **intercept**(`context`, `next`): `Promise`\<`unknown`\>

#### Parameters

##### context

[`GraphQLInterceptorContext`](/api/protocols-graphql/src/type-aliases/graphqlinterceptorcontext/)

##### next

[`GraphQLCallHandler`](/api/protocols-graphql/src/interfaces/graphqlcallhandler/)

#### Returns

`Promise`\<`unknown`\>

#### Implementation of

[`GraphQLInterceptor`](/api/protocols-graphql/src/interfaces/graphqlinterceptor/).[`intercept`](/api/protocols-graphql/src/interfaces/graphqlinterceptor/#intercept)
