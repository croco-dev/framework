---
editUrl: false
next: false
prev: false
title: "usePageData"
---

> **usePageData**\<`T`\>(): `T` \| `undefined`

SSR로 전달된 페이지 데이터에 선택적으로 접근한다.
App entry에서 PageDataProvider로 래핑 필요.

이 훅은 hydration payload를 검증하지 않는다. 런타임 검증이 필요하면
`useParsedPageData()`를 사용한다.

## Type Parameters

### T

`T` = `unknown`

## Returns

`T` \| `undefined`

페이지 데이터 또는 provider/data가 없을 때 undefined
