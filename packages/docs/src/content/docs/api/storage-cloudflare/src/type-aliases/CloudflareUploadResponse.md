---
editUrl: false
next: false
prev: false
title: "CloudflareUploadResponse"
---

> **CloudflareUploadResponse** = `object`

Cloudflare Images 업로드 응답 구조입니다.

## Properties

### errors

> **errors**: `unknown`[]

에러 목록

---

### messages

> **messages**: `unknown`[]

메시지 목록

---

### result

> **result**: `object`

업로드 결과

#### filename

> **filename**: `string`

원본 파일명

#### id

> **id**: `string`

이미지 ID (고유 식별자)

#### requireSignedURLs

> **requireSignedURLs**: `boolean`

서명된 URL 필요 여부

#### uploaded

> **uploaded**: `string`

업로드 시간

#### variants

> **variants**: `string`[]

가능한 변형(variants) URL 목록

---

### success

> **success**: `boolean`

성공 여부
