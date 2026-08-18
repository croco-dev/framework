---
editUrl: false
next: false
prev: false
title: "TraceDecoratorOptions"
---

> **TraceDecoratorOptions** = `object`

`@Trace` 데코레이터의 동작을 제어하는 옵션 타입입니다.

## Properties

### attributes?

> `optional` **attributes?**: `Attributes`

Span에 추가할 속성 집합입니다.

***

### name?

> `optional` **name?**: `string`

Span 이름입니다. 기본값은 메서드 이름입니다.
