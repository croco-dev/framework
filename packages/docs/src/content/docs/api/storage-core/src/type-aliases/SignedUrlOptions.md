---
editUrl: false
next: false
prev: false
title: "SignedUrlOptions"
---

> **SignedUrlOptions** = [`StorageOperationOptions`](/api/storage-core/src/type-aliases/storageoperationoptions/) & `object`

서명된 URL 생성 옵션

## Type Declaration

### expiresIn

> **expiresIn**: `number`

URL 만료 시간 (초 단위). 1초 이상 604,800초(7일) 이하의 안전한 정수여야 합니다.
