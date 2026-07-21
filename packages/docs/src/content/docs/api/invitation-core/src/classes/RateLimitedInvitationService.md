---
editUrl: false
next: false
prev: false
title: "RateLimitedInvitationService"
---

초대 스팸 방지와 batch invite를 제공하는 상위 서비스입니다.

## Constructors

### Constructor

> **new RateLimitedInvitationService**(`manager`, `store`, `config?`): `RateLimitedInvitationService`

#### Parameters

##### manager

[`InvitationManager`](/api/invitation-core/src/classes/invitationmanager/)

##### store

[`InvitationStore`](/api/invitation-core/src/classes/invitationstore/)

##### config?

[`RateLimitConfig`](/api/invitation-core/src/type-aliases/ratelimitconfig/) \| `undefined`

#### Returns

`RateLimitedInvitationService`

## Methods

### batchInvite()

> **batchInvite**(`tenantId`, `emails`, `options?`): `Promise`\<[`BatchInviteResult`](/api/invitation-core/src/type-aliases/batchinviteresult/)\>

#### Parameters

##### tenantId

`string`

##### emails

`string`[]

##### options?

[`BatchInviteOptions`](/api/invitation-core/src/type-aliases/batchinviteoptions/) = `{}`

#### Returns

`Promise`\<[`BatchInviteResult`](/api/invitation-core/src/type-aliases/batchinviteresult/)\>

***

### checkRateLimit()

> **checkRateLimit**(`tenantId`): `Promise`\<`void`\>

#### Parameters

##### tenantId

`string`

#### Returns

`Promise`\<`void`\>

***

### createEmailInvitationWithRateLimit()

> **createEmailInvitationWithRateLimit**(`input`): `Promise`\<`string`\>

#### Parameters

##### input

`CreateEmailInvitationInput`

#### Returns

`Promise`\<`string`\>

***

### createLinkInvitationWithRateLimit()

> **createLinkInvitationWithRateLimit**(`input`): `Promise`\<`string`\>

#### Parameters

##### input

`CreateLinkInvitationInput`

#### Returns

`Promise`\<`string`\>
