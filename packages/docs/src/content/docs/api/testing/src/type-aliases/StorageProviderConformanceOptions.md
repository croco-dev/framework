---
editUrl: false
next: false
prev: false
title: "StorageProviderConformanceOptions"
---

> **StorageProviderConformanceOptions** = `object`

## Properties

### createProvider()

> `readonly` **createProvider**: () => [`StorageProvider`](/api/storage-core/src/type-aliases/storageprovider/) \| `Promise`\<[`StorageProvider`](/api/storage-core/src/type-aliases/storageprovider/)\>

#### Returns

[`StorageProvider`](/api/storage-core/src/type-aliases/storageprovider/) \| `Promise`\<[`StorageProvider`](/api/storage-core/src/type-aliases/storageprovider/)\>

***

### keyPrefix?

> `readonly` `optional` **keyPrefix**: `string`

***

### metadata?

> `readonly` `optional` **metadata**: `object`

#### contentType?

> `readonly` `optional` **contentType**: [`StorageProviderOptionalMetadataExpectation`](/api/testing/src/type-aliases/storageprovideroptionalmetadataexpectation/)

#### customMetadata?

> `readonly` `optional` **customMetadata**: [`StorageProviderOptionalMetadataExpectation`](/api/testing/src/type-aliases/storageprovideroptionalmetadataexpectation/)

***

### providerName

> `readonly` **providerName**: `string`

***

### publicUrl?

> `readonly` `optional` **publicUrl**: [`StorageProviderUrlExpectation`](/api/testing/src/type-aliases/storageproviderurlexpectation/)

***

### signedUrl?

> `readonly` `optional` **signedUrl**: [`StorageProviderUrlExpectation`](/api/testing/src/type-aliases/storageproviderurlexpectation/)
