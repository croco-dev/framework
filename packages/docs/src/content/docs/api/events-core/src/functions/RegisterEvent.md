---
editUrl: false
next: false
prev: false
title: "RegisterEvent"
---

> **RegisterEvent**(`registry?`): \<`T`\>(`target`) => `EventClass`\<`T`\>

Defined in: [packages/events-core/src/libs/EventRegistry.ts:65](https://github.com/croco-dev/shared/blob/f4909b56644431401bcba1824d0465856b7783c7/packages/events-core/src/libs/EventRegistry.ts#L65)

이벤트 클래스를 레지스트리에 자동 등록하는 데코레이터 팩토리

## Parameters

### registry?

[`EventRegistry`](/api/events-core/src/classes/eventregistry/) = `globalEventRegistry`

등록에 사용할 레지스트리 (기본값: 전역 레지스트리)

## Returns

> \<`T`\>(`target`): `EventClass`\<`T`\>

### Type Parameters

#### T

`T` *extends* [`DomainEvent`](/api/events-core/src/classes/domainevent/)

### Parameters

#### target

`EventClass`\<`T`\>

### Returns

`EventClass`\<`T`\>
