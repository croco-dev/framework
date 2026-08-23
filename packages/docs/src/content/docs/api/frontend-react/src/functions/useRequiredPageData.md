---
editUrl: false
next: false
prev: false
title: "useRequiredPageData"
---

> **useRequiredPageData**\<`T`\>(): `T`

SSR로 전달된 필수 페이지 데이터에 접근한다.

## Type Parameters

### T

`T` = `unknown`

## Returns

`T`

페이지 데이터 (타입 T로 캐스팅)

## Throws

`PageDataUnavailableProblem` when the provider has no defined data.
