---
editUrl: false
next: false
prev: false
title: "StorageProviderConformanceOptions"
---

> **StorageProviderConformanceOptions** = `object`

## Properties

### createProvider()

> `readonly` **createProvider**: () => `StorageProvider` \| `Promise`\<`StorageProvider`\>

#### Returns

`StorageProvider` \| `Promise`\<`StorageProvider`\>

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
