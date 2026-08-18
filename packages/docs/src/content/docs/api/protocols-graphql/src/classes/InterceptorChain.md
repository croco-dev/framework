---
editUrl: false
next: false
prev: false
title: "InterceptorChain"
---

## Constructors

### Constructor

> **new InterceptorChain**(`interceptors`): `InterceptorChain`

#### Parameters

##### interceptors

[`GraphQLInterceptor`](/api/protocols-graphql/src/interfaces/graphqlinterceptor/)[]

#### Returns

`InterceptorChain`

## Methods

### execute()

> **execute**\<`T`\>(`context`, `finalHandler`): `Promise`\<`T`\>

#### Type Parameters

##### T

`T`

#### Parameters

##### context

[`GraphQLInterceptorContext`](/api/protocols-graphql/src/type-aliases/graphqlinterceptorcontext/)

##### finalHandler

() => `Promise`\<`T`\>

#### Returns

`Promise`\<`T`\>

---

### execute()

> `static` **execute**\<`T`\>(`interceptors`, `context`, `finalHandler`): `Promise`\<`T`\>

#### Type Parameters

##### T

`T`

#### Parameters

##### interceptors

[`GraphQLInterceptor`](/api/protocols-graphql/src/interfaces/graphqlinterceptor/)[]

##### context

[`GraphQLInterceptorContext`](/api/protocols-graphql/src/type-aliases/graphqlinterceptorcontext/)

##### finalHandler

() => `Promise`\<`T`\>

#### Returns

`Promise`\<`T`\>
