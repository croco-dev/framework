---
editUrl: false
next: false
prev: false
title: "LoggingInterceptor"
---

## Implements

- [`GraphQLInterceptor`](/api/protocols-graphql/src/interfaces/graphqlinterceptor/)

## Constructors

### Constructor

> **new LoggingInterceptor**(`logger`): `LoggingInterceptor`

#### Parameters

##### logger

[`ILogger`](/api/framework-context/src/interfaces/ilogger/)

#### Returns

`LoggingInterceptor`

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
