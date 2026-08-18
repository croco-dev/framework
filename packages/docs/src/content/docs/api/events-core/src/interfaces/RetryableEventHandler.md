---
editUrl: false
next: false
prev: false
title: "RetryableEventHandler"
---

재시도 가능한 이벤트 핸들러를 위한 인터페이스입니다.

## Methods

### getRetryPolicy()

> **getRetryPolicy**(): `Partial`\<[`DeadLetterPolicy`](/api/events-core/src/type-aliases/deadletterpolicy/)\>

핸들러의 재시도 정책을 반환합니다.

#### Returns

`Partial`\<[`DeadLetterPolicy`](/api/events-core/src/type-aliases/deadletterpolicy/)\>

***

### onExhaustedRetries()?

> `optional` **onExhaustedRetries**\<`TEvent`\>(`event`, `error`): `Promise`\<`void`\>

재시도 횟수를 초과했을 때 호출됩니다.

#### Type Parameters

##### TEvent

`TEvent` *extends* [`DomainEvent`](/api/events-core/src/classes/domainevent/)

#### Parameters

##### event

`TEvent`

실패한 이벤트

##### error

`Error`

마지막 에러

#### Returns

`Promise`\<`void`\>
