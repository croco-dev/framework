---
editUrl: false
next: false
prev: false
title: "AbstractDrizzleRepository"
---

Drizzle 트랜잭션 관련 타입 유틸리티입니다.

## Example

```typescript
import { InferTxClient, InferTxOptions } from '@croco/tx-drizzle';

type TxClient = InferTxClient<typeof db>;
type TxOptions = InferTxOptions<typeof db>;
```

## Type Parameters

### TEntity

`TEntity`

### TId

`TId`

### TDb

`TDb` *extends* [`DrizzleDb`](/api/tx-drizzle/src/interfaces/drizzledb/)\<`unknown`\> = [`DrizzleDb`](/api/tx-drizzle/src/interfaces/drizzledb/)

## Implements

- [`Repository`](/api/repository-core/src/interfaces/repository/)\<`TEntity`, `TId`\>

## Constructors

### Constructor

> **new AbstractDrizzleRepository**\<`TEntity`, `TId`, `TDb`\>(`db`, `txManager`): `AbstractDrizzleRepository`\<`TEntity`, `TId`, `TDb`\>

#### Parameters

##### db

`TDb`

##### txManager

[`TxManager`](/api/tx-core/src/classes/txmanager/)\<[`InferTxClient`](/api/tx-drizzle/src/type-aliases/infertxclient/)\<`TDb`\>\>

#### Returns

`AbstractDrizzleRepository`\<`TEntity`, `TId`, `TDb`\>

## Methods

### deleteById()

> `abstract` **deleteById**(`id`): `Promise`\<`void`\>

Delete an entity by its ID.

#### Parameters

##### id

`TId`

The ID of the entity to delete

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`Repository`](/api/repository-core/src/interfaces/repository/).[`deleteById`](/api/repository-core/src/interfaces/repository/#deletebyid)

***

### findById()

> `abstract` **findById**(`id`): `Promise`\<`TEntity`\>

Find a single entity by its ID.

#### Parameters

##### id

`TId`

The entity ID

#### Returns

`Promise`\<`TEntity`\>

The entity if found, null otherwise

#### Implementation of

[`Repository`](/api/repository-core/src/interfaces/repository/).[`findById`](/api/repository-core/src/interfaces/repository/#findbyid)

***

### findByIds()

> `abstract` **findByIds**(`ids`): `Promise`\<`TEntity`[]\>

Find multiple entities by their IDs.

#### Parameters

##### ids

`TId`[]

Array of entity IDs

#### Returns

`Promise`\<`TEntity`[]\>

Array of entities (may be empty or contain nulls)

#### Implementation of

[`Repository`](/api/repository-core/src/interfaces/repository/).[`findByIds`](/api/repository-core/src/interfaces/repository/#findbyids)

***

### save()

> `abstract` **save**(`entity`): `Promise`\<`TEntity`\>

Save an entity (insert or update).

#### Parameters

##### entity

`TEntity`

The entity to save

#### Returns

`Promise`\<`TEntity`\>

The saved entity (possibly with generated fields like ID)

#### Implementation of

[`Repository`](/api/repository-core/src/interfaces/repository/).[`save`](/api/repository-core/src/interfaces/repository/#save)
