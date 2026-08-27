---
editUrl: false
next: false
prev: false
title: "InMemoryStorageProvider"
---

인메모리 스토리지 제공자 구현체 (테스트용)

Map을 사용하여 파일을 메모리에 저장합니다. 실제 운영 환경에서는 사용하지 말고
테스트나 개발 환경에서만 사용하세요.

## Extends

- [`BaseStorageProvider`](/api/storage-core/src/classes/basestorageprovider/)

## Constructors

### Constructor

> **new InMemoryStorageProvider**(`baseUrl?`): `InMemoryStorageProvider`

#### Parameters

##### baseUrl?

`string` = `"https://example.com"`

#### Returns

`InMemoryStorageProvider`

#### Overrides

[`BaseStorageProvider`](/api/storage-core/src/classes/basestorageprovider/).[`constructor`](/api/storage-core/src/classes/basestorageprovider/#constructor)

## Methods

### clear()

> **clear**(): `void`

#### Returns

`void`

***

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

***

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

***

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

***

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

#### Overrides

[`BaseStorageProvider`](/api/storage-core/src/classes/basestorageprovider/).[`getPublicUrl`](/api/storage-core/src/classes/basestorageprovider/#getpublicurl)

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

#### Overrides

[`BaseStorageProvider`](/api/storage-core/src/classes/basestorageprovider/).[`getSignedUrl`](/api/storage-core/src/classes/basestorageprovider/#getsignedurl)

***

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

***

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
