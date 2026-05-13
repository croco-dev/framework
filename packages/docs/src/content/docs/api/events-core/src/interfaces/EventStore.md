---
editUrl: false
next: false
prev: false
title: "EventStore"
---

이벤트 저장소 인터페이스입니다.
이벤트 리플레이를 위해 이벤트를 저장하고 조회하는 계약을 정의합니다.

## Methods

### append()

> **append**\<`TEvent`\>(`event`): `Promise`\<`void`\>

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

저장된 이벤트 수를 반환합니다.

#### Returns

`Promise`\<`number`\>

***

### getById()

> **getById**\<`TEvent`\>(`eventId`): `Promise`\<`TEvent`\>

특정 이벤트를 ID로 조회합니다.

#### Type Parameters

##### TEvent

`TEvent` *extends* [`DomainEvent`](/api/events-core/src/classes/domainevent/)

#### Parameters

##### eventId

`string`

이벤트 ID

#### Returns

`Promise`\<`TEvent`\>

이벤트 또는 undefined

***

### read()

> **read**\<`TEvent`\>(`options?`): `Promise`\<`TEvent`[]\>

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
