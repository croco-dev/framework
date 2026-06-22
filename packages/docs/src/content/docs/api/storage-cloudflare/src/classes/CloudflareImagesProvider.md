---
editUrl: false
next: false
prev: false
title: "CloudflareImagesProvider"
---

Cloudflare Images를 이용해 파일 저장과 이미지 변환 URL 생성을 제공하는 구현체입니다.

## Extends

- [`BaseStorageProvider`](/api/storage-core/src/classes/basestorageprovider/)

## Implements

- [`ImageProvider`](/api/storage-core/src/type-aliases/imageprovider/)

## Constructors

### Constructor

> **new CloudflareImagesProvider**(`options`): `CloudflareImagesProvider`

#### Parameters

##### options

[`CloudflareImagesOptions`](/api/storage-cloudflare/src/type-aliases/cloudflareimagesoptions/)

#### Returns

`CloudflareImagesProvider`

#### Overrides

[`BaseStorageProvider`](/api/storage-core/src/classes/basestorageprovider/).[`constructor`](/api/storage-core/src/classes/basestorageprovider/#constructor)

## Methods

### delete()

> **delete**(`key`): `Promise`\<`void`\>

파일 삭제

#### Parameters

##### key

`string`

파일 식별자

#### Returns

`Promise`\<`void`\>

#### Overrides

[`BaseStorageProvider`](/api/storage-core/src/classes/basestorageprovider/).[`delete`](/api/storage-core/src/classes/basestorageprovider/#delete)

---

### exists()

> **exists**(`key`): `Promise`\<`boolean`\>

파일 존재 여부 확인

#### Parameters

##### key

`string`

파일 식별자

#### Returns

`Promise`\<`boolean`\>

#### Inherited from

[`BaseStorageProvider`](/api/storage-core/src/classes/basestorageprovider/).[`exists`](/api/storage-core/src/classes/basestorageprovider/#exists)

---

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

#### Overrides

[`BaseStorageProvider`](/api/storage-core/src/classes/basestorageprovider/).[`get`](/api/storage-core/src/classes/basestorageprovider/#get)

---

### getMetadata()

> **getMetadata**(`key`): `Promise`\<\{ `contentType?`: `string`; `etag?`: `string`; `lastModified`: `Date`; `size`: `number`; \}\>

객체 메타데이터 조회

#### Parameters

##### key

`string`

파일 식별자

#### Returns

`Promise`\<\{ `contentType?`: `string`; `etag?`: `string`; `lastModified`: `Date`; `size`: `number`; \}\>

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

#### Inherited from

[`BaseStorageProvider`](/api/storage-core/src/classes/basestorageprovider/).[`getStream`](/api/storage-core/src/classes/basestorageprovider/#getstream)

---

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

#### Implementation of

`ImageProvider.getTransformUrl`

---

### getUploadIntent()

> **getUploadIntent**(`key`, `options?`): `Promise`\<[`UploadIntent`](/api/storage-core/src/type-aliases/uploadintent/)\>

클라이언트 직접 업로드를 위한 의도 생성 (선택)

#### Parameters

##### key

`string`

업로드할 파일 식별자

##### options?

###### ttlInSeconds?

`number`

#### Returns

`Promise`\<[`UploadIntent`](/api/storage-core/src/type-aliases/uploadintent/)\>

업로드 의도 정보

#### Implementation of

`ImageProvider.getUploadIntent`

---

### put()

> **put**(`key`, `data`, `options?`): `Promise`\<`void`\>

파일 업로드

#### Parameters

##### key

`string`

파일 식별자

##### data

`Readable` \| `Buffer`\<`ArrayBufferLike`\>

파일 데이터 (Buffer 또는 Readable 스트림)

##### options?

[`PutOptions`](/api/storage-core/src/type-aliases/putoptions/)

업로드 옵션

#### Returns

`Promise`\<`void`\>

#### Overrides

[`BaseStorageProvider`](/api/storage-core/src/classes/basestorageprovider/).[`put`](/api/storage-core/src/classes/basestorageprovider/#put)
