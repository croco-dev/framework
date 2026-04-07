---
editUrl: false
next: false
prev: false
title: "EventStore"
---

Defined in: [packages/events-core/src/libs/interfaces/EventReplay.ts:129](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/events-core/src/libs/interfaces/EventReplay.ts#L129)

이벤트 저장소 인터페이스입니다.
이벤트 리플레이를 위해 이벤트를 저장하고 조회하는 계약을 정의합니다.

## Methods

### append()

> **append**\<`TEvent`\>(`event`): `Promise`\<`void`\>

Defined in: [packages/events-core/src/libs/interfaces/EventReplay.ts:134](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/events-core/src/libs/interfaces/EventReplay.ts#L134)

이벤트를 저장합니다.

#### Type Parameters

##### TEvent

`TEvent` *extends* [`DomainEvent`](/api/events-core/src/classes/domainevent/)

#### Parameters

##### event

`TEvent`

저장할 이벤트

#### Returns

`Promise`\<`void`\>

***

### appendMany()

> **appendMany**\<`TEvent`\>(`events`): `Promise`\<`void`\>

Defined in: [packages/events-core/src/libs/interfaces/EventReplay.ts:140](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/events-core/src/libs/interfaces/EventReplay.ts#L140)

여러 이벤트를 저장합니다.

#### Type Parameters

##### TEvent

`TEvent` *extends* [`DomainEvent`](/api/events-core/src/classes/domainevent/)

#### Parameters

##### events

`TEvent`[]

저장할 이벤트 목록

#### Returns

`Promise`\<`void`\>

***

### count()

> **count**(): `Promise`\<`number`\>

Defined in: [packages/events-core/src/libs/interfaces/EventReplay.ts:159](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/events-core/src/libs/interfaces/EventReplay.ts#L159)

저장된 이벤트 수를 반환합니다.

#### Returns

`Promise`\<`number`\>

***

### getById()

> **getById**\<`TEvent`\>(`eventId`): `Promise`\<`TEvent` \| `undefined`\>

Defined in: [packages/events-core/src/libs/interfaces/EventReplay.ts:154](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/events-core/src/libs/interfaces/EventReplay.ts#L154)

특정 이벤트를 ID로 조회합니다.

#### Type Parameters

##### TEvent

`TEvent` *extends* [`DomainEvent`](/api/events-core/src/classes/domainevent/)

#### Parameters

##### eventId

`string`

이벤트 ID

#### Returns

`Promise`\<`TEvent` \| `undefined`\>

이벤트 또는 undefined

***

### read()

> **read**\<`TEvent`\>(`options?`): `Promise`\<`TEvent`[]\>

Defined in: [packages/events-core/src/libs/interfaces/EventReplay.ts:147](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/events-core/src/libs/interfaces/EventReplay.ts#L147)

특정 조건으로 이벤트를 조회합니다.

#### Type Parameters

##### TEvent

`TEvent` *extends* [`DomainEvent`](/api/events-core/src/classes/domainevent/)

#### Parameters

##### options?

[`ReplayOptions`](/api/events-core/src/type-aliases/replayoptions/)

조회 옵션

#### Returns

`Promise`\<`TEvent`[]\>

이벤트 목록
