---
editUrl: false
next: false
prev: false
title: "EventOrdering"
---

순서 보장 이벤트 버스 인터페이스입니다.
같은 파티션 키를 가진 이벤트의 순서를 보장하는 계약을 정의합니다.

## Methods

### flushAll()

> **flushAll**(): `Promise`\<`void`\>

모든 파티션의 대기 중인 이벤트를 강제로 flush합니다.

#### Returns

`Promise`\<`void`\>

***

### flushPartition()

> **flushPartition**(`partitionKey`): `Promise`\<`void`\>

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

모든 파티션의 상태를 조회합니다.

#### Returns

`Promise`\<[`PartitionStatus`](/api/events-core/src/type-aliases/partitionstatus/)[]\>

파티션 상태 목록

***

### getPartitionStatus()

> **getPartitionStatus**(`partitionKey`): `Promise`\<[`PartitionStatus`](/api/events-core/src/type-aliases/partitionstatus/) \| `undefined`\>

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
