---
editUrl: false
next: false
prev: false
title: "CloudflareImageDetails"
---

> **CloudflareImageDetails** = `object`

Cloudflare Images 상세 조회 응답 구조입니다.

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

> **result**: \{ `filename`: `string`; `id`: `string`; `requireSignedURLs`: `boolean`; `size?`: `number`; `uploaded`: `string`; `variants`: `string`[]; \} \| `null`

이미지 상세 정보

#### Union Members

##### Type Literal

\{ `filename`: `string`; `id`: `string`; `requireSignedURLs`: `boolean`; `size?`: `number`; `uploaded`: `string`; `variants`: `string`[]; \}

##### filename

> **filename**: `string`

원본 파일명

##### id

> **id**: `string`

이미지 ID

##### requireSignedURLs

> **requireSignedURLs**: `boolean`

서명된 URL 필요 여부

##### size?

> `optional` **size?**: `number`

이미지 크기 (bytes)

##### uploaded

> **uploaded**: `string`

업로드 시간

##### variants

> **variants**: `string`[]

가능한 변성(variants) URL 목록

---

`null`

---

### success

> **success**: `boolean`

성공 여부
