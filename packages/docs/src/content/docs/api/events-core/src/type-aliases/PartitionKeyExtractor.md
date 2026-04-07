---
editUrl: false
next: false
prev: false
title: "PartitionKeyExtractor"
---

> **PartitionKeyExtractor**\<`TEvent`\> = (`event`) => `string`

Defined in: [packages/events-core/src/libs/interfaces/EventOrdering.ts:6](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/events-core/src/libs/interfaces/EventOrdering.ts#L6)

파티션 키 추출 함수 타입입니다.

## Type Parameters

### TEvent

`TEvent` *extends* [`DomainEvent`](/api/events-core/src/classes/domainevent/) = [`DomainEvent`](/api/events-core/src/classes/domainevent/)

## Parameters

### event

`TEvent`

## Returns

`string`
