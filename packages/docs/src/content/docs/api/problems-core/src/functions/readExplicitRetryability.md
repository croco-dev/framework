---
editUrl: false
next: false
prev: false
title: "readExplicitRetryability"
---

> **readExplicitRetryability**(`error`): `boolean` \| `undefined`

오류가 명시한 재시도 분류를 읽습니다.
최상위 `retryable` boolean을 먼저 보고, 없으면 `extensions.retryable` boolean을 봅니다.
boolean이 아닌 값이나 읽을 수 없는 속성은 명시 분류로 취급하지 않습니다.

## Parameters

### error

`unknown`

분류를 읽을 오류 값

## Returns

`boolean` \| `undefined`

명시된 재시도 가능 여부, 명시 분류가 없으면 `undefined`
