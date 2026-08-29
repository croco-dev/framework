---
editUrl: false
next: false
prev: false
title: "ImageProvider"
---

> **ImageProvider** = `object`

이미지 처리 제공자 인터페이스

CDN 기반 이미지 변환을 위한 추상화 계층입니다.
Cloudflare Images, Cloudinary, imgix 등을 지원합니다.

## Methods

### getTransformUrl()

> **getTransformUrl**(`key`, `options`): `string`

변환된 이미지 URL 반환

CDN에서 실시간으로 이미지를 변환하고 반환합니다.

#### Parameters

##### key

`string`

원본 이미지 식별자

##### options

[`TransformOptions`](/api/storage-core/src/type-aliases/transformoptions/)

변환 옵션

#### Returns

`string`

변환된 이미지의 공개 URL

---

### getUploadIntent()?

> `optional` **getUploadIntent**(`key`, `options?`): `Promise`\<[`UploadIntent`](/api/storage-core/src/type-aliases/uploadintent/)\>

클라이언트 직접 업로드를 위한 의도 생성 (선택)

#### Parameters

##### key

`string`

업로드할 파일 식별자

##### options?

[`UploadIntentOptions`](/api/storage-core/src/type-aliases/uploadintentoptions/)

만료 시간과 공통 연산 옵션

#### Returns

`Promise`\<[`UploadIntent`](/api/storage-core/src/type-aliases/uploadintent/)\>

업로드 의도 정보
