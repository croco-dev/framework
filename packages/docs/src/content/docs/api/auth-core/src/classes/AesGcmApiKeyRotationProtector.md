---
editUrl: false
next: false
prev: false
title: "AesGcmApiKeyRotationProtector"
---

Rotation-capable AES-256-GCM protection for replayable API key rotations.

Ciphertexts carry the key ID used to encrypt them. Keep old protection keys configured
for as long as rotation records encrypted with them must remain replayable.

## Implements

- [`ApiKeyRotationProtector`](/api/auth-core/src/interfaces/apikeyrotationprotector/)

## Constructors

### Constructor

> **new AesGcmApiKeyRotationProtector**(`options`): `AesGcmApiKeyRotationProtector`

#### Parameters

##### options

[`AesGcmApiKeyRotationProtectorOptions`](/api/auth-core/src/type-aliases/aesgcmapikeyrotationprotectoroptions/)

#### Returns

`AesGcmApiKeyRotationProtector`

## Methods

### decrypt()

> **decrypt**(`ciphertext`, `context`): `string`

#### Parameters

##### ciphertext

`string`

##### context

[`ApiKeyRotationProtectionContext`](/api/auth-core/src/type-aliases/apikeyrotationprotectioncontext/)

#### Returns

`string`

#### Implementation of

[`ApiKeyRotationProtector`](/api/auth-core/src/interfaces/apikeyrotationprotector/).[`decrypt`](/api/auth-core/src/interfaces/apikeyrotationprotector/#decrypt)

***

### encrypt()

> **encrypt**(`rawKey`, `context`): `string`

#### Parameters

##### rawKey

`string`

##### context

[`ApiKeyRotationProtectionContext`](/api/auth-core/src/type-aliases/apikeyrotationprotectioncontext/)

#### Returns

`string`

#### Implementation of

[`ApiKeyRotationProtector`](/api/auth-core/src/interfaces/apikeyrotationprotector/).[`encrypt`](/api/auth-core/src/interfaces/apikeyrotationprotector/#encrypt)
