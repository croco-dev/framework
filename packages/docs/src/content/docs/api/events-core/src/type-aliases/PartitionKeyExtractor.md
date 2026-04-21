---
editUrl: false
next: false
prev: false
title: "PartitionKeyExtractor"
---

> **PartitionKeyExtractor**\<`TEvent`\> = (`event`) => `string`

Defined in: [packages/events-core/src/libs/interfaces/EventOrdering.ts:6](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/events-core/src/libs/interfaces/EventOrdering.ts#L6)

파티션 키 추출 함수 타입입니다.

## Type Parameters

### TEvent

`TEvent` *extends* [`DomainEvent`](/api/events-core/src/classes/domainevent/) = [`DomainEvent`](/api/events-core/src/classes/domainevent/)

## Parameters

### event

`TEvent`

## Returns

`string`
