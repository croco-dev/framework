---
editUrl: false
next: false
prev: false
title: "TraceDecoratorOptions"
---

> **TraceDecoratorOptions** = `object`

Defined in: [packages/telemetry-api/src/libs/decorators/Trace.ts:4](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/telemetry-api/src/libs/decorators/Trace.ts#L4)

`@Trace` 데코레이터의 동작을 제어하는 옵션 타입입니다.

## Properties

### attributes?

> `optional` **attributes**: `Attributes`

Defined in: [packages/telemetry-api/src/libs/decorators/Trace.ts:6](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/telemetry-api/src/libs/decorators/Trace.ts#L6)

Span에 추가할 속성 집합입니다.

***

### name?

> `optional` **name**: `string`

Defined in: [packages/telemetry-api/src/libs/decorators/Trace.ts:5](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/telemetry-api/src/libs/decorators/Trace.ts#L5)

Span 이름입니다. 기본값은 메서드 이름입니다.
