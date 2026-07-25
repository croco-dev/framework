---
editUrl: false
next: false
prev: false
title: "TypedMeteredOptions"
---

> **TypedMeteredOptions**\<`TMeter`\> = `false` _extends_ `TypedMeteredValidity`\<`TMeter`\> ? `never` : `object`

Metered 메서드 데코레이터의 메타데이터 타입입니다.

## Type Parameters

### TMeter

`TMeter` _extends_ [`MeterRef`](/api/metering-core/src/type-aliases/meterref/)

## Description

`@Metered` 데코레이터로 메서드에 정의된 자동 기록 옵션의 메타데이터를 나타냅니다.
