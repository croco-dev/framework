---
editUrl: false
next: false
prev: false
title: "InMemoryDeadLetterQueue"
---

Process-local dead-letter storage for tests, development, and single-process runtimes.
Entries are deduplicated by stable event and handler identity.

## Implements

- [`DeadLetterQueue`](/api/events-core/src/interfaces/deadletterqueue/)

## Constructors

### Constructor

> **new InMemoryDeadLetterQueue**(): `InMemoryDeadLetterQueue`

#### Returns

`InMemoryDeadLetterQueue`

## Methods

### clear()

> **clear**(): `Promise`\<`void`\>

DLQ를 비웁니다.

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`DeadLetterQueue`](/api/events-core/src/interfaces/deadletterqueue/).[`clear`](/api/events-core/src/interfaces/deadletterqueue/#clear)

---

### dequeue()

> **dequeue**\<`TEvent`\>(`limit?`): `Promise`\<[`InMemoryDeadLetterItem`](/api/events-inmemory/src/type-aliases/inmemorydeadletteritem/)\<`TEvent`\>[]\>

DLQ에서 이벤트를 꺼내 재처리합니다.
반환한 항목은 다른 동시 소비자가 다시 받지 않도록 원자적으로 claim하거나 제거해야 합니다.
재처리에 실패한 소비자는 같은 eventId와 handlerId로 항목을 다시 저장해야 합니다.

#### Type Parameters

##### TEvent

`TEvent` _extends_ [`DomainEvent`](/api/events-core/src/classes/domainevent/)

#### Parameters

##### limit?

`number`

최대 조회 개수

#### Returns

`Promise`\<[`InMemoryDeadLetterItem`](/api/events-inmemory/src/type-aliases/inmemorydeadletteritem/)\<`TEvent`\>[]\>

DLQ 항목 목록

#### Implementation of

[`DeadLetterQueue`](/api/events-core/src/interfaces/deadletterqueue/).[`dequeue`](/api/events-core/src/interfaces/deadletterqueue/#dequeue)

---

### enqueue()

> **enqueue**\<`TEvent`\>(`item`): `Promise`\<`void`\>

이벤트를 DLQ에 저장합니다.
같은 eventId와 handlerId 조합의 활성 항목은 중복 저장하지 않아야 합니다.

#### Type Parameters

##### TEvent

`TEvent` _extends_ [`DomainEvent`](/api/events-core/src/classes/domainevent/)

#### Parameters

##### item

[`DeadLetterItem`](/api/events-core/src/type-aliases/deadletteritem/)\<`TEvent`\>

저장할 DLQ 항목

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`DeadLetterQueue`](/api/events-core/src/interfaces/deadletterqueue/).[`enqueue`](/api/events-core/src/interfaces/deadletterqueue/#enqueue)

---

### peek()

> **peek**\<`TEvent`\>(): `Promise`\<[`InMemoryDeadLetterItem`](/api/events-inmemory/src/type-aliases/inmemorydeadletteritem/)\<`TEvent`\>[]\>

DLQ의 모든 항목을 조회합니다.

#### Type Parameters

##### TEvent

`TEvent` _extends_ [`DomainEvent`](/api/events-core/src/classes/domainevent/)

#### Returns

`Promise`\<[`InMemoryDeadLetterItem`](/api/events-inmemory/src/type-aliases/inmemorydeadletteritem/)\<`TEvent`\>[]\>

DLQ 항목 목록

#### Implementation of

[`DeadLetterQueue`](/api/events-core/src/interfaces/deadletterqueue/).[`peek`](/api/events-core/src/interfaces/deadletterqueue/#peek)

---

### remove()

> **remove**(`itemId`): `Promise`\<`void`\>

특정 항목을 DLQ에서 제거합니다.

#### Parameters

##### itemId

`string`

제거할 항목 ID (event.eventId 또는 별도 ID)

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`DeadLetterQueue`](/api/events-core/src/interfaces/deadletterqueue/).[`remove`](/api/events-core/src/interfaces/deadletterqueue/#remove)

---

### size()

> **size**(): `Promise`\<`number`\>

DLQ의 항목 개수를 반환합니다.

#### Returns

`Promise`\<`number`\>

#### Implementation of

[`DeadLetterQueue`](/api/events-core/src/interfaces/deadletterqueue/).[`size`](/api/events-core/src/interfaces/deadletterqueue/#size)
