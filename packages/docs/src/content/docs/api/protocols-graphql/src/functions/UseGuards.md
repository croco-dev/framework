---
editUrl: false
next: false
prev: false
title: "UseGuards"
---

> **UseGuards**(...`guards`): `MethodDecorator`

Associates Croco guards with a GraphQL resolver method.

Inherited guards execute before guards declared on the overriding method.

## Parameters

### guards

...[`ClassType`](/api/protocols-graphql/src/type-aliases/classtype/)\<[`GraphQLGuard`](/api/protocols-graphql/src/type-aliases/graphqlguard/)\>[]

## Returns

`MethodDecorator`
