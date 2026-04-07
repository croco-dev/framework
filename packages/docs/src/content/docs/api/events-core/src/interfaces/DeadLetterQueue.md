---
editUrl: false
next: false
prev: false
title: "DeadLetterQueue"
---

Defined in: [packages/events-core/src/libs/interfaces/DeadLetterQueue.ts:64](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/events-core/src/libs/interfaces/DeadLetterQueue.ts#L64)

죽은 편지 큐(DLQ) 인터페이스입니다.
처리 실패한 이벤트를 저장하고 관리하는 계약을 정의합니다.

## Methods

### clear()

> **clear**(): `Promise`\<`void`\>

Defined in: [packages/events-core/src/libs/interfaces/DeadLetterQueue.ts:98](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/events-core/src/libs/interfaces/DeadLetterQueue.ts#L98)

DLQ를 비웁니다.

#### Returns

`Promise`\<`void`\>

***

### dequeue()

> **dequeue**\<`TEvent`\>(`limit?`): `Promise`\<[`DeadLetterItem`](/api/events-core/src/type-aliases/deadletteritem/)\<`TEvent`\>[]\>

Defined in: [packages/events-core/src/libs/interfaces/DeadLetterQueue.ts:76](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/events-core/src/libs/interfaces/DeadLetterQueue.ts#L76)

DLQ에서 이벤트를 꺼내 재처리합니다.

#### Type Parameters

##### TEvent

`TEvent` *extends* [`DomainEvent`](/api/events-core/src/classes/domainevent/)

#### Parameters

##### limit?

`number`

최대 조회 개수

#### Returns

`Promise`\<[`DeadLetterItem`](/api/events-core/src/type-aliases/deadletteritem/)\<`TEvent`\>[]\>

DLQ 항목 목록

***

### enqueue()

> **enqueue**\<`TEvent`\>(`item`): `Promise`\<`void`\>

Defined in: [packages/events-core/src/libs/interfaces/DeadLetterQueue.ts:69](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/events-core/src/libs/interfaces/DeadLetterQueue.ts#L69)

이벤트를 DLQ에 저장합니다.

#### Type Parameters

##### TEvent

`TEvent` *extends* [`DomainEvent`](/api/events-core/src/classes/domainevent/)

#### Parameters

##### item

[`DeadLetterItem`](/api/events-core/src/type-aliases/deadletteritem/)\<`TEvent`\>

저장할 DLQ 항목

#### Returns

`Promise`\<`void`\>

***

### peek()

> **peek**\<`TEvent`\>(): `Promise`\<[`DeadLetterItem`](/api/events-core/src/type-aliases/deadletteritem/)\<`TEvent`\>[]\>

Defined in: [packages/events-core/src/libs/interfaces/DeadLetterQueue.ts:88](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/events-core/src/libs/interfaces/DeadLetterQueue.ts#L88)

DLQ의 모든 항목을 조회합니다.

#### Type Parameters

##### TEvent

`TEvent` *extends* [`DomainEvent`](/api/events-core/src/classes/domainevent/)

#### Returns

`Promise`\<[`DeadLetterItem`](/api/events-core/src/type-aliases/deadletteritem/)\<`TEvent`\>[]\>

DLQ 항목 목록

***

### remove()

> **remove**(`itemId`): `Promise`\<`void`\>

Defined in: [packages/events-core/src/libs/interfaces/DeadLetterQueue.ts:82](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/events-core/src/libs/interfaces/DeadLetterQueue.ts#L82)

특정 항목을 DLQ에서 제거합니다.

#### Parameters

##### itemId

`string`

제거할 항목 ID (event.eventId 또는 별도 ID)

#### Returns

`Promise`\<`void`\>

***

### size()

> **size**(): `Promise`\<`number`\>

Defined in: [packages/events-core/src/libs/interfaces/DeadLetterQueue.ts:93](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/events-core/src/libs/interfaces/DeadLetterQueue.ts#L93)

DLQ의 항목 개수를 반환합니다.

#### Returns

`Promise`\<`number`\>
