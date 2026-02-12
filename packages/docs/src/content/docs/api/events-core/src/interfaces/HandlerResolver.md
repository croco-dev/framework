---
editUrl: false
next: false
prev: false
title: "HandlerResolver"
---

Defined in: [packages/events-core/src/libs/HandlerResolver.ts:8](https://github.com/croco-dev/shared/blob/6c740cec42c19b94e53a518f632803f284903537/packages/events-core/src/libs/HandlerResolver.ts#L8)

DI 컨테이너 추상화 인터페이스
외부 DI 컨테이너(TypeDI 등)와 통합하기 위해 사용합니다.

## Methods

### resolve()

> **resolve**\<`T`\>(`handlerClass`): [`EventHandler`](/api/events-core/src/interfaces/eventhandler/)\<`T`\>

Defined in: [packages/events-core/src/libs/HandlerResolver.ts:9](https://github.com/croco-dev/shared/blob/6c740cec42c19b94e53a518f632803f284903537/packages/events-core/src/libs/HandlerResolver.ts#L9)

#### Type Parameters

##### T

`T` *extends* [`DomainEvent`](/api/events-core/src/classes/domainevent/)

#### Parameters

##### handlerClass

[`EventHandlerClass`](/api/events-core/src/type-aliases/eventhandlerclass/)\<`T`\>

#### Returns

[`EventHandler`](/api/events-core/src/interfaces/eventhandler/)\<`T`\>
