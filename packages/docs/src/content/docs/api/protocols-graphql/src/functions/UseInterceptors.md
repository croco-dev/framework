---
editUrl: false
next: false
prev: false
title: "UseInterceptors"
---

> **UseInterceptors**(...`interceptors`): `MethodDecorator`

Associates Croco interceptors with a GraphQL resolver method.

Interceptors execute in declaration order with standard onion semantics.

## Parameters

### interceptors

...[`ClassType`](/api/protocols-graphql/src/type-aliases/classtype/)\<[`GraphQLInterceptor`](/api/protocols-graphql/src/interfaces/graphqlinterceptor/)\>[]

## Returns

`MethodDecorator`
