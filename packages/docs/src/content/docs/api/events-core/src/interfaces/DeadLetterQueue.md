---
editUrl: false
next: false
prev: false
title: "DeadLetterQueue"
---

죽은 편지 큐(DLQ) 인터페이스입니다.
처리 실패한 이벤트를 저장하고 관리하는 계약을 정의합니다.

## Methods

### clear()

> **clear**(): `Promise`\<`void`\>

DLQ를 비웁니다.

#### Returns

`Promise`\<`void`\>

---

### dequeue()

> **dequeue**\<`TEvent`\>(`limit?`): `Promise`\<[`DeadLetterItem`](/api/events-core/src/type-aliases/deadletteritem/)\<`TEvent`\>[]\>

DLQ에서 이벤트를 꺼내 재처리합니다.
반환한 항목은 다른 동시 소비자가 다시 받지 않도록 원자적으로 제거해야 합니다.
반환 전 제거가 완료되어야 하며, 별도 성공 확인이 필요한 lease/claim 방식은 이 계약에 해당하지 않습니다.
재처리에 실패한 소비자는 같은 eventId와 handlerId로 항목을 다시 저장하거나 저장 실패 시 복구 책임을 반환해야 합니다.

#### Type Parameters

##### TEvent

`TEvent` _extends_ [`DomainEvent`](/api/events-core/src/classes/domainevent/)

#### Parameters

##### limit?

`number`

최대 조회 개수

#### Returns

`Promise`\<[`DeadLetterItem`](/api/events-core/src/type-aliases/deadletteritem/)\<`TEvent`\>[]\>

DLQ 항목 목록

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

---

### peek()

> **peek**\<`TEvent`\>(): `Promise`\<[`DeadLetterItem`](/api/events-core/src/type-aliases/deadletteritem/)\<`TEvent`\>[]\>

DLQ의 모든 항목을 조회합니다.

#### Type Parameters

##### TEvent

`TEvent` _extends_ [`DomainEvent`](/api/events-core/src/classes/domainevent/)

#### Returns

`Promise`\<[`DeadLetterItem`](/api/events-core/src/type-aliases/deadletteritem/)\<`TEvent`\>[]\>

DLQ 항목 목록

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

---

### size()

> **size**(): `Promise`\<`number`\>

DLQ의 항목 개수를 반환합니다.

#### Returns

`Promise`\<`number`\>
