---
editUrl: false
next: false
prev: false
title: "ValidationPipe"
---

파라미터 값을 Zod 스키마로 검증하는 기본 Pipe 구현체입니다.

## Type Parameters

### T

`T` = `unknown`

## Implements

- [`PipeTransform`](/api/protocols-rest/src/interfaces/pipetransform/)\<`unknown`, `T`\>

## Constructors

### Constructor

> **new ValidationPipe**\<`T`\>(`schema`): `ValidationPipe`\<`T`\>

#### Parameters

##### schema

`ZodType`\<`T`\>

#### Returns

`ValidationPipe`\<`T`\>

## Methods

### transform()

> **transform**(`value`, `metadata`): `T`

#### Parameters

##### value

`unknown`

##### metadata

[`ArgumentMetadata`](/api/protocols-rest/src/interfaces/argumentmetadata/)

#### Returns

`T`

#### Implementation of

[`PipeTransform`](/api/protocols-rest/src/interfaces/pipetransform/).[`transform`](/api/protocols-rest/src/interfaces/pipetransform/#transform)
