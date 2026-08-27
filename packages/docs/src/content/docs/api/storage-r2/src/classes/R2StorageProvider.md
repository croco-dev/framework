---
editUrl: false
next: false
prev: false
title: "R2StorageProvider"
---

Cloudflare R2 스토리지 제공자

AWS S3 SDK를 사용하여 R2와 통신합니다.

## Extends

- [`BaseStorageProvider`](/api/storage-core/src/classes/basestorageprovider/)

## Constructors

### Constructor

> **new R2StorageProvider**(`config`, `_logger`): `R2StorageProvider`

#### Parameters

##### config

[`ConfigService`](/api/framework-config/src/classes/configservice/)

##### \_logger

[`Logger`](/api/framework-logger/src/classes/logger/)

#### Returns

`R2StorageProvider`

#### Overrides

[`BaseStorageProvider`](/api/storage-core/src/classes/basestorageprovider/).[`constructor`](/api/storage-core/src/classes/basestorageprovider/#constructor)

## Properties

### \_logger

> `readonly` **\_logger**: [`Logger`](/api/framework-logger/src/classes/logger/)

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

#### Overrides

[`BaseStorageProvider`](/api/storage-core/src/classes/basestorageprovider/).[`delete`](/api/storage-core/src/classes/basestorageprovider/#delete)

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

#### Overrides

[`BaseStorageProvider`](/api/storage-core/src/classes/basestorageprovider/).[`exists`](/api/storage-core/src/classes/basestorageprovider/#exists)

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

#### Overrides

[`BaseStorageProvider`](/api/storage-core/src/classes/basestorageprovider/).[`get`](/api/storage-core/src/classes/basestorageprovider/#get)

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

#### Overrides

[`BaseStorageProvider`](/api/storage-core/src/classes/basestorageprovider/).[`getMetadata`](/api/storage-core/src/classes/basestorageprovider/#getmetadata)

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

#### Overrides

[`BaseStorageProvider`](/api/storage-core/src/classes/basestorageprovider/).[`getPublicUrl`](/api/storage-core/src/classes/basestorageprovider/#getpublicurl)

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

#### Overrides

[`BaseStorageProvider`](/api/storage-core/src/classes/basestorageprovider/).[`getSignedUrl`](/api/storage-core/src/classes/basestorageprovider/#getsignedurl)

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

#### Overrides

[`BaseStorageProvider`](/api/storage-core/src/classes/basestorageprovider/).[`getStream`](/api/storage-core/src/classes/basestorageprovider/#getstream)

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

#### Overrides

[`BaseStorageProvider`](/api/storage-core/src/classes/basestorageprovider/).[`put`](/api/storage-core/src/classes/basestorageprovider/#put)
