---
editUrl: false
next: false
prev: false
title: "StorageProvider"
---

> **StorageProvider** = `object`

스토리지 제공자 인터페이스

원시 파일 저장소(S3, Blob Storage 등)를 위한 추상화 계층입니다.

## Methods

### delete()

> **delete**(`key`, `options?`): `Promise`\<`void`\>

파일 삭제

#### Parameters

##### key

`string`

파일 식별자

##### options?

[`StorageOperationOptions`](/api/storage-core/src/type-aliases/storageoperationoptions/)

공통 연산 옵션

#### Returns

`Promise`\<`void`\>

---

### exists()

> **exists**(`key`, `options?`): `Promise`\<`boolean`\>

파일 존재 여부 확인

#### Parameters

##### key

`string`

파일 식별자

##### options?

[`StorageOperationOptions`](/api/storage-core/src/type-aliases/storageoperationoptions/)

공통 연산 옵션

#### Returns

`Promise`\<`boolean`\>

---

### get()

> **get**(`key`, `options?`): `Promise`\<`Uint8Array`\<`ArrayBufferLike`\>\>

파일 다운로드

#### Parameters

##### key

`string`

파일 식별자

##### options?

[`StorageOperationOptions`](/api/storage-core/src/type-aliases/storageoperationoptions/)

#### Returns

`Promise`\<`Uint8Array`\<`ArrayBufferLike`\>\>

파일 바이트

#### Throws

FileNotFoundProblem - 파일이 존재하지 않을 때

---

### getMetadata()

> **getMetadata**(`key`, `options?`): `Promise`\<[`ObjectMetadata`](/api/storage-core/src/type-aliases/objectmetadata/)\>

객체 메타데이터 조회

#### Parameters

##### key

`string`

파일 식별자

##### options?

[`StorageOperationOptions`](/api/storage-core/src/type-aliases/storageoperationoptions/)

공통 연산 옵션

#### Returns

`Promise`\<[`ObjectMetadata`](/api/storage-core/src/type-aliases/objectmetadata/)\>

객체 메타데이터

#### Throws

FileNotFoundProblem - 파일이 존재하지 않을 때

---

### getPublicUrl()

> **getPublicUrl**(`key`): `string`

공개 URL 반환

#### Parameters

##### key

`string`

파일 식별자

#### Returns

`string`

공개 액세스 가능한 URL

---

### getSignedUrl()

> **getSignedUrl**(`key`, `options`): `Promise`\<`string`\>

서명된 URL 반환 (임시 액세스)

#### Parameters

##### key

`string`

파일 식별자

##### options

[`SignedUrlOptions`](/api/storage-core/src/type-aliases/signedurloptions/)

만료 시간 등 옵션

#### Returns

`Promise`\<`string`\>

서명된 URL

---

### getStream()

> **getStream**(`key`, `options?`): `Promise`\<[`StorageStream`](/api/storage-core/src/type-aliases/storagestream/)\>

파일 스트림 다운로드

#### Parameters

##### key

`string`

파일 식별자

##### options?

[`StorageOperationOptions`](/api/storage-core/src/type-aliases/storageoperationoptions/)

#### Returns

`Promise`\<[`StorageStream`](/api/storage-core/src/type-aliases/storagestream/)\>

Web 읽기 가능 스트림

#### Throws

FileNotFoundProblem - 파일이 존재하지 않을 때

---

### put()

> **put**(`key`, `data`, `options?`): `Promise`\<`void`\>

파일 업로드

#### Parameters

##### key

`string`

파일 식별자

##### data

[`StorageBody`](/api/storage-core/src/type-aliases/storagebody/)

파일 데이터 또는 Web ReadableStream

##### options?

[`PutOptions`](/api/storage-core/src/type-aliases/putoptions/)

업로드 옵션

#### Returns

`Promise`\<`void`\>
