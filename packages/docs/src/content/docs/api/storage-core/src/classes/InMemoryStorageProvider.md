---
editUrl: false
next: false
prev: false
title: "InMemoryStorageProvider"
---

인메모리 스토리지 제공자 구현체 (테스트용)

Map을 사용하여 파일을 메모리에 저장합니다. 실제 운영 환경에서는 사용하지 말고
테스트나 개발 환경에서만 사용하세요.

## Implements

- [`StorageProvider`](/api/storage-core/src/type-aliases/storageprovider/)

## Constructors

### Constructor

> **new InMemoryStorageProvider**(`baseUrl?`): `InMemoryStorageProvider`

#### Parameters

##### baseUrl?

`string` = `"https://example.com"`

#### Returns

`InMemoryStorageProvider`

## Methods

### clear()

> **clear**(): `void`

#### Returns

`void`

***

### delete()

> **delete**(`key`): `Promise`\<`void`\>

파일 삭제

#### Parameters

##### key

`string`

파일 식별자

#### Returns

`Promise`\<`void`\>

#### Implementation of

`StorageProvider.delete`

***

### exists()

> **exists**(`key`): `Promise`\<`boolean`\>

파일 존재 여부 확인

#### Parameters

##### key

`string`

파일 식별자

#### Returns

`Promise`\<`boolean`\>

#### Implementation of

`StorageProvider.exists`

***

### get()

> **get**(`key`): `Promise`\<`Buffer`\<`ArrayBufferLike`\>\>

파일 다운로드

#### Parameters

##### key

`string`

파일 식별자

#### Returns

`Promise`\<`Buffer`\<`ArrayBufferLike`\>\>

파일 버퍼

#### Throws

FileNotFoundProblem - 파일이 존재하지 않을 때

#### Implementation of

`StorageProvider.get`

***

### getMetadata()

> **getMetadata**(`key`): `Promise`\<[`ObjectMetadata`](/api/storage-core/src/type-aliases/objectmetadata/)\>

객체 메타데이터 조회

#### Parameters

##### key

`string`

파일 식별자

#### Returns

`Promise`\<[`ObjectMetadata`](/api/storage-core/src/type-aliases/objectmetadata/)\>

객체 메타데이터

#### Throws

FileNotFoundProblem - 파일이 존재하지 않을 때

#### Implementation of

`StorageProvider.getMetadata`

***

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

#### Implementation of

`StorageProvider.getPublicUrl`

***

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

#### Implementation of

`StorageProvider.getSignedUrl`

***

### getStream()

> **getStream**(`key`): `Promise`\<`Readable`\>

파일 스트림 다운로드

#### Parameters

##### key

`string`

파일 식별자

#### Returns

`Promise`\<`Readable`\>

읽기 가능한 스트림

#### Throws

FileNotFoundProblem - 파일이 존재하지 않을 때

#### Implementation of

`StorageProvider.getStream`

***

### put()

> **put**(`key`, `data`, `options?`): `Promise`\<`void`\>

파일 업로드

#### Parameters

##### key

`string`

파일 식별자

##### data

`Buffer`\<`ArrayBufferLike`\> \| `Readable`

파일 데이터 (Buffer 또는 Readable 스트림)

##### options?

[`PutOptions`](/api/storage-core/src/type-aliases/putoptions/)

업로드 옵션

#### Returns

`Promise`\<`void`\>

#### Implementation of

`StorageProvider.put`
