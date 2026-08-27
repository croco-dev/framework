---
editUrl: false
next: false
prev: false
title: "StorageOperationOptions"
---

> **StorageOperationOptions** = `object`

모든 비동기 스토리지 연산이 공유하는 호출 옵션입니다.

## Properties

### signal?

> `readonly` `optional` **signal?**: `AbortSignal`

호출자 취소 신호입니다. 이미 취소된 신호는 원격 연산을 시작하기 전에 거부됩니다.
