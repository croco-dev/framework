---
editUrl: false
next: false
prev: false
title: "RegisterEventHandler"
---

> **RegisterEventHandler**(`eventClass`, `options?`): \<`T`\>(`f`) => `T`

Defined in: [packages/events-core/src/libs/EventHandler.ts:10](https://github.com/croco-dev/shared/blob/e527eda2a2bdade5e61e156787935d7ae66c2fea/packages/events-core/src/libs/EventHandler.ts#L10)

이벤트 타입과 핸들러를 연결하는 클래스 데코레이터입니다.

## Parameters

### eventClass

(...`args`) => [`DomainEvent`](/api/events-core/src/classes/domainevent/)

### options?

#### eventName?

`string`

## Returns

> \<`T`\>(`f`): `T`

### Type Parameters

#### T

`T` *extends* [`EventHandlerClass`](/api/events-core/src/type-aliases/eventhandlerclass/)\<[`DomainEvent`](/api/events-core/src/classes/domainevent/)\>

### Parameters

#### f

`T`

### Returns

`T`
