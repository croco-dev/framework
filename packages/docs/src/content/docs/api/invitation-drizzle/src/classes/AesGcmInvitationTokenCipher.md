---
editUrl: false
next: false
prev: false
title: "AesGcmInvitationTokenCipher"
---

Rotation-capable AES-256-GCM protection for replayable invitation tokens.

Ciphertexts carry the key ID used to encrypt them. Keep old keys configured
until all creation intents encrypted with them have expired or been removed.

## Implements

- [`InvitationTokenCipher`](/api/invitation-drizzle/src/interfaces/invitationtokencipher/)

## Constructors

### Constructor

> **new AesGcmInvitationTokenCipher**(`options`): `AesGcmInvitationTokenCipher`

#### Parameters

##### options

[`AesGcmInvitationTokenCipherOptions`](/api/invitation-drizzle/src/type-aliases/aesgcminvitationtokencipheroptions/)

#### Returns

`AesGcmInvitationTokenCipher`

## Methods

### decrypt()

> **decrypt**(`ciphertext`, `context`): `string`

#### Parameters

##### ciphertext

`string`

##### context

[`InvitationTokenCipherContext`](/api/invitation-drizzle/src/type-aliases/invitationtokenciphercontext/)

#### Returns

`string`

#### Implementation of

[`InvitationTokenCipher`](/api/invitation-drizzle/src/interfaces/invitationtokencipher/).[`decrypt`](/api/invitation-drizzle/src/interfaces/invitationtokencipher/#decrypt)

---

### encrypt()

> **encrypt**(`token`, `context`): `string`

#### Parameters

##### token

`string`

##### context

[`InvitationTokenCipherContext`](/api/invitation-drizzle/src/type-aliases/invitationtokenciphercontext/)

#### Returns

`string`

#### Implementation of

[`InvitationTokenCipher`](/api/invitation-drizzle/src/interfaces/invitationtokencipher/).[`encrypt`](/api/invitation-drizzle/src/interfaces/invitationtokencipher/#encrypt)
