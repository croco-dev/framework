---
editUrl: false
next: false
prev: false
title: "GuardChain"
---

## Constructors

### Constructor

> **new GuardChain**(`guards`): `GuardChain`

#### Parameters

##### guards

[`GraphQLGuard`](/api/protocols-graphql/src/type-aliases/graphqlguard/)[]

#### Returns

`GuardChain`

## Methods

### canActivate()

> **canActivate**(`context`): `Promise`\<`boolean`\>

#### Parameters

##### context

[`GraphQLGuardContext`](/api/protocols-graphql/src/type-aliases/graphqlguardcontext/)

#### Returns

`Promise`\<`boolean`\>

---

### execute()

> `static` **execute**(`guards`, `context`): `Promise`\<`boolean`\>

#### Parameters

##### guards

[`GraphQLGuard`](/api/protocols-graphql/src/type-aliases/graphqlguard/)[]

##### context

[`GraphQLGuardContext`](/api/protocols-graphql/src/type-aliases/graphqlguardcontext/)

#### Returns

`Promise`\<`boolean`\>
