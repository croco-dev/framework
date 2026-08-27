---
editUrl: false
next: false
prev: false
title: "BaseStorageProvider"
---

스토리지 제공자 구현을 위한 기본 추상 클래스입니다.

## Extended by

- [`CloudflareImagesProvider`](/api/storage-cloudflare/src/classes/cloudflareimagesprovider/)
- [`CloudinaryProvider`](/api/storage-cloudinary/src/classes/cloudinaryprovider/)
- [`InMemoryStorageProvider`](/api/storage-core/src/classes/inmemorystorageprovider/)
- [`R2StorageProvider`](/api/storage-r2/src/classes/r2storageprovider/)

## Implements

- [`StorageProvider`](/api/storage-core/src/type-aliases/storageprovider/)

## Constructors

### Constructor

> **new BaseStorageProvider**(): `BaseStorageProvider`

#### Returns

`BaseStorageProvider`

## Methods

### delete()

> `abstract` **delete**(`key`, `options?`): `Promise`\<`void`\>

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

#### Implementation of

`StorageProvider.delete`

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

#### Implementation of

`StorageProvider.exists`

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

#### Implementation of

`StorageProvider.get`

***

### getMetadata()

> `abstract` **getMetadata**(`key`, `options?`): `Promise`\<[`ObjectMetadata`](/api/storage-core/src/type-aliases/objectmetadata/)\>

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

#### Implementation of

`StorageProvider.getMetadata`

***

### getPublicUrl()

> `abstract` **getPublicUrl**(`key`): `string`

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

> `abstract` **getSignedUrl**(`key`, `options`): `Promise`\<`string`\>

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

> `abstract` **getStream**(`key`, `options?`): `Promise`\<[`StorageStream`](/api/storage-core/src/type-aliases/storagestream/)\>

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

#### Implementation of

`StorageProvider.getStream`

***

### put()

> `abstract` **put**(`key`, `data`, `options?`): `Promise`\<`void`\>

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

#### Implementation of

`StorageProvider.put`
