---
editUrl: false
next: false
prev: false
title: "DefaultHandlerResolver"
---

생성자 의존성이 없는 핸들러를 직접 생성할 때 명시적으로 선택하는 리졸버입니다.

## Implements

- [`HandlerResolver`](/api/events-core/src/interfaces/handlerresolver/)

## Constructors

### Constructor

> **new DefaultHandlerResolver**(): `DefaultHandlerResolver`

#### Returns

`DefaultHandlerResolver`

## Methods

### resolve()

> **resolve**\<`T`\>(`handlerClass`): [`EventHandler`](/api/events-core/src/interfaces/eventhandler/)\<`T`\>

#### Type Parameters

##### T

`T` _extends_ [`DomainEvent`](/api/events-core/src/classes/domainevent/)

#### Parameters

##### handlerClass

[`EventHandlerClass`](/api/events-core/src/type-aliases/eventhandlerclass/)\<`T`\>

#### Returns

[`EventHandler`](/api/events-core/src/interfaces/eventhandler/)\<`T`\>

#### Implementation of

[`HandlerResolver`](/api/events-core/src/interfaces/handlerresolver/).[`resolve`](/api/events-core/src/interfaces/handlerresolver/#resolve)
