---
editUrl: false
next: false
prev: false
title: "TransactionContext"
---

Defined in: [packages/events-core/src/libs/TransactionContext.ts:3](https://github.com/croco-dev/shared/blob/e527eda2a2bdade5e61e156787935d7ae66c2fea/packages/events-core/src/libs/TransactionContext.ts#L3)

트랜잭션 컨텍스트 DI 토큰과 컨텍스트 계약 타입입니다.

## Methods

### isInTransaction()

> **isInTransaction**(): `boolean`

Defined in: [packages/events-core/src/libs/TransactionContext.ts:4](https://github.com/croco-dev/shared/blob/e527eda2a2bdade5e61e156787935d7ae66c2fea/packages/events-core/src/libs/TransactionContext.ts#L4)

#### Returns

`boolean`

***

### onAfterCommit()

> **onAfterCommit**(`hook`): `void`

Defined in: [packages/events-core/src/libs/TransactionContext.ts:5](https://github.com/croco-dev/shared/blob/e527eda2a2bdade5e61e156787935d7ae66c2fea/packages/events-core/src/libs/TransactionContext.ts#L5)

#### Parameters

##### hook

() => `void` \| `Promise`\<`void`\>

#### Returns

`void`
