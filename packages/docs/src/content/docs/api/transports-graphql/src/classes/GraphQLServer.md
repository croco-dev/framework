---
editUrl: false
next: false
prev: false
title: "GraphQLServer"
---

GraphQL Yoga server runtime.

## Constructors

### Constructor

> **new GraphQLServer**(`options?`): `GraphQLServer`

#### Parameters

##### options?

[`GraphQLServerOptions`](/api/transports-graphql/src/type-aliases/graphqlserveroptions/) = `{}`

#### Returns

`GraphQLServer`

## Methods

### getHandler()

> **getHandler**(): `YogaHandler`

#### Returns

`YogaHandler`

***

### initialize()

> **initialize**(): `Promise`\<`void`\>

#### Returns

`Promise`\<`void`\>

***

### start()

> **start**(`port`): `Promise`\<`void`\>

#### Parameters

##### port

`number`

#### Returns

`Promise`\<`void`\>

***

### stop()

> **stop**(): `Promise`\<`void`\>

#### Returns

`Promise`\<`void`\>
