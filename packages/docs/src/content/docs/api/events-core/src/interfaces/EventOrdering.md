---
editUrl: false
next: false
prev: false
title: "EventOrdering"
---

Defined in: [packages/events-core/src/libs/interfaces/EventOrdering.ts:81](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/events-core/src/libs/interfaces/EventOrdering.ts#L81)

순서 보장 이벤트 버스 인터페이스입니다.
같은 파티션 키를 가진 이벤트의 순서를 보장하는 계약을 정의합니다.

## Methods

### flushAll()

> **flushAll**(): `Promise`\<`void`\>

Defined in: [packages/events-core/src/libs/interfaces/EventOrdering.ts:118](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/events-core/src/libs/interfaces/EventOrdering.ts#L118)

모든 파티션의 대기 중인 이벤트를 강제로 flush합니다.

#### Returns

`Promise`\<`void`\>

***

### flushPartition()

> **flushPartition**(`partitionKey`): `Promise`\<`void`\>

Defined in: [packages/events-core/src/libs/interfaces/EventOrdering.ts:113](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/events-core/src/libs/interfaces/EventOrdering.ts#L113)

특정 파티션의 대기 중인 이벤트를 강제로 flush합니다.

#### Parameters

##### partitionKey

`string`

파티션 키

#### Returns

`Promise`\<`void`\>

***

### getAllPartitionStatus()

> **getAllPartitionStatus**(): `Promise`\<[`PartitionStatus`](/api/events-core/src/type-aliases/partitionstatus/)[]\>

Defined in: [packages/events-core/src/libs/interfaces/EventOrdering.ts:107](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/events-core/src/libs/interfaces/EventOrdering.ts#L107)

모든 파티션의 상태를 조회합니다.

#### Returns

`Promise`\<[`PartitionStatus`](/api/events-core/src/type-aliases/partitionstatus/)[]\>

파티션 상태 목록

***

### getPartitionStatus()

> **getPartitionStatus**(`partitionKey`): `Promise`\<[`PartitionStatus`](/api/events-core/src/type-aliases/partitionstatus/) \| `undefined`\>

Defined in: [packages/events-core/src/libs/interfaces/EventOrdering.ts:101](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/events-core/src/libs/interfaces/EventOrdering.ts#L101)

특정 파티션의 처리 상태를 조회합니다.

#### Parameters

##### partitionKey

`string`

파티션 키

#### Returns

`Promise`\<[`PartitionStatus`](/api/events-core/src/type-aliases/partitionstatus/) \| `undefined`\>

파티션 상태

***

### publishOrdered()

> **publishOrdered**\<`TEvent`\>(`event`, `partitionKey`): `Promise`\<`void`\>

Defined in: [packages/events-core/src/libs/interfaces/EventOrdering.ts:88](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/events-core/src/libs/interfaces/EventOrdering.ts#L88)

이벤트를 순서대로 발행합니다.
같은 파티션 키를 가진 이벤트는 순서가 보장됩니다.

#### Type Parameters

##### TEvent

`TEvent` *extends* [`DomainEvent`](/api/events-core/src/classes/domainevent/)

#### Parameters

##### event

`TEvent`

발행할 이벤트

##### partitionKey

`string`

파티션 키

#### Returns

`Promise`\<`void`\>

***

### publishOrderedMany()

> **publishOrderedMany**\<`TEvent`\>(`events`): `Promise`\<`void`\>

Defined in: [packages/events-core/src/libs/interfaces/EventOrdering.ts:94](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/events-core/src/libs/interfaces/EventOrdering.ts#L94)

여러 이벤트를 순서대로 발행합니다.

#### Type Parameters

##### TEvent

`TEvent` *extends* [`DomainEvent`](/api/events-core/src/classes/domainevent/)

#### Parameters

##### events

`object`[]

이벤트와 파티션 키의 목록

#### Returns

`Promise`\<`void`\>
