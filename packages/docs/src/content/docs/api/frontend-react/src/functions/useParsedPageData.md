---
editUrl: false
next: false
prev: false
title: "useParsedPageData"
---

> **useParsedPageData**\<`T`\>(`parser`): `T` \| `undefined`

SSR로 전달된 페이지 데이터를 parser로 검증한 뒤 반환한다.

Parser는 data가 있을 때만 호출되며 parser가 던진 validation failure는 그대로 전파된다.

## Type Parameters

### T

`T`

## Parameters

### parser

#### parse

(`input`) => `T`

## Returns

`T` \| `undefined`

검증된 페이지 데이터 또는 provider/data가 없을 때 undefined
