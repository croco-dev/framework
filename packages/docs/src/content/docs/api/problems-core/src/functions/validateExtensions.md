---
editUrl: false
next: false
prev: false
title: "validateExtensions"
---

> **validateExtensions**(`extensions`): [`ProblemExtensions`](/api/problems-core/src/type-aliases/problemextensions/)

확장 필드를 검증하고 ProblemExtensions 타입으로 변환합니다.

## Parameters

### extensions

`unknown`

검증할 확장 필드 객체

## Returns

[`ProblemExtensions`](/api/problems-core/src/type-aliases/problemextensions/)

검증된 ProblemExtensions

## Throws

extensions가 JSON-safe plain object가 아닌 경우
