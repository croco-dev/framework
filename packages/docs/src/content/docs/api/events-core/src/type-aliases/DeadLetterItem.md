---
editUrl: false
next: false
prev: false
title: "DeadLetterItem"
---

> **DeadLetterItem**\<`TEvent`\> = `object`

Defined in: [packages/events-core/src/libs/interfaces/DeadLetterQueue.ts:6](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/events-core/src/libs/interfaces/DeadLetterQueue.ts#L6)

죽은 편지 큐(DLQ)에 저장된 이벤트 항목입니다.

## Type Parameters

### TEvent

`TEvent` *extends* [`DomainEvent`](/api/events-core/src/classes/domainevent/) = [`DomainEvent`](/api/events-core/src/classes/domainevent/)

## Properties

### event

> **event**: `TEvent`

Defined in: [packages/events-core/src/libs/interfaces/DeadLetterQueue.ts:8](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/events-core/src/libs/interfaces/DeadLetterQueue.ts#L8)

원본 이벤트

***

### failedAt

> **failedAt**: `Date`

Defined in: [packages/events-core/src/libs/interfaces/DeadLetterQueue.ts:14](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/events-core/src/libs/interfaces/DeadLetterQueue.ts#L14)

실패 시간

***

### handlerId?

> `optional` **handlerId**: `string`

Defined in: [packages/events-core/src/libs/interfaces/DeadLetterQueue.ts:23](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/events-core/src/libs/interfaces/DeadLetterQueue.ts#L23)

핸들러 식별자 (어떤 핸들러에서 실패했는지)

***

### lastError?

> `optional` **lastError**: `string`

Defined in: [packages/events-core/src/libs/interfaces/DeadLetterQueue.ts:20](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/events-core/src/libs/interfaces/DeadLetterQueue.ts#L20)

마지막 에러 메시지

***

### metadata?

> `optional` **metadata**: `Record`\<`string`, `unknown`\>

Defined in: [packages/events-core/src/libs/interfaces/DeadLetterQueue.ts:26](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/events-core/src/libs/interfaces/DeadLetterQueue.ts#L26)

추가 메타데이터

***

### reason

> **reason**: `string`

Defined in: [packages/events-core/src/libs/interfaces/DeadLetterQueue.ts:11](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/events-core/src/libs/interfaces/DeadLetterQueue.ts#L11)

실패 원인

***

### retryCount

> **retryCount**: `number`

Defined in: [packages/events-core/src/libs/interfaces/DeadLetterQueue.ts:17](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/events-core/src/libs/interfaces/DeadLetterQueue.ts#L17)

재시도 횟수
