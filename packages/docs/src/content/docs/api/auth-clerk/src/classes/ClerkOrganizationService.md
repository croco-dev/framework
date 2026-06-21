---
editUrl: false
next: false
prev: false
title: "ClerkOrganizationService"
---

Clerk 조직, 멤버십, 초대를 관리하는 서비스입니다.

## Constructors

### Constructor

> **new ClerkOrganizationService**(`options`): `ClerkOrganizationService`

#### Parameters

##### options

[`ClerkAuthOptions`](/api/auth-clerk/src/type-aliases/clerkauthoptions/)

#### Returns

`ClerkOrganizationService`

## Methods

### createOrganization()

> **createOrganization**(`input`): `Promise`\<[`ClerkOrganization`](/api/auth-clerk/src/type-aliases/clerkorganization/)\>

#### Parameters

##### input

[`CreateOrganizationInput`](/api/auth-clerk/src/type-aliases/createorganizationinput/)

#### Returns

`Promise`\<[`ClerkOrganization`](/api/auth-clerk/src/type-aliases/clerkorganization/)\>

***

### createOrganizationInvitation()

> **createOrganizationInvitation**(`input`): `Promise`\<[`ClerkOrganizationInvitation`](/api/auth-clerk/src/type-aliases/clerkorganizationinvitation/)\>

#### Parameters

##### input

[`CreateInvitationInput`](/api/auth-clerk/src/type-aliases/createinvitationinput/)

#### Returns

`Promise`\<[`ClerkOrganizationInvitation`](/api/auth-clerk/src/type-aliases/clerkorganizationinvitation/)\>

***

### createOrganizationMembership()

> **createOrganizationMembership**(`input`): `Promise`\<[`ClerkOrganizationMembership`](/api/auth-clerk/src/type-aliases/clerkorganizationmembership/)\>

#### Parameters

##### input

[`CreateMembershipInput`](/api/auth-clerk/src/type-aliases/createmembershipinput/)

#### Returns

`Promise`\<[`ClerkOrganizationMembership`](/api/auth-clerk/src/type-aliases/clerkorganizationmembership/)\>

***

### deleteOrganization()

> **deleteOrganization**(`organizationId`): `Promise`\<`void`\>

#### Parameters

##### organizationId

`string`

#### Returns

`Promise`\<`void`\>

***

### deleteOrganizationMembership()

> **deleteOrganizationMembership**(`organizationId`, `userId`): `Promise`\<`void`\>

#### Parameters

##### organizationId

`string`

##### userId

`string`

#### Returns

`Promise`\<`void`\>

***

### getOrganization()

> **getOrganization**(`organizationId`): `Promise`\<[`ClerkOrganization`](/api/auth-clerk/src/type-aliases/clerkorganization/) \| `null`\>

#### Parameters

##### organizationId

`string`

#### Returns

`Promise`\<[`ClerkOrganization`](/api/auth-clerk/src/type-aliases/clerkorganization/) \| `null`\>

***

### getOrganizationBySlug()

> **getOrganizationBySlug**(`slug`): `Promise`\<[`ClerkOrganization`](/api/auth-clerk/src/type-aliases/clerkorganization/) \| `null`\>

#### Parameters

##### slug

`string`

#### Returns

`Promise`\<[`ClerkOrganization`](/api/auth-clerk/src/type-aliases/clerkorganization/) \| `null`\>

***

### getOrganizationInvitationList()

> **getOrganizationInvitationList**(`organizationId`): `Promise`\<\{ `invitations`: [`ClerkOrganizationInvitation`](/api/auth-clerk/src/type-aliases/clerkorganizationinvitation/)[]; `totalCount`: `number`; \}\>

#### Parameters

##### organizationId

`string`

#### Returns

`Promise`\<\{ `invitations`: [`ClerkOrganizationInvitation`](/api/auth-clerk/src/type-aliases/clerkorganizationinvitation/)[]; `totalCount`: `number`; \}\>

***

### getOrganizationList()

> **getOrganizationList**(`options?`): `Promise`\<[`OrganizationListResult`](/api/auth-clerk/src/type-aliases/organizationlistresult/)\>

#### Parameters

##### options?

[`OrganizationListOptions`](/api/auth-clerk/src/type-aliases/organizationlistoptions/) = `{}`

#### Returns

`Promise`\<[`OrganizationListResult`](/api/auth-clerk/src/type-aliases/organizationlistresult/)\>

***

### getOrganizationMembershipList()

> **getOrganizationMembershipList**(`organizationId`, `_options?`): `Promise`\<\{ `memberships`: [`ClerkOrganizationMembership`](/api/auth-clerk/src/type-aliases/clerkorganizationmembership/)[]; `totalCount`: `number`; \}\>

#### Parameters

##### organizationId

`string`

##### \_options?

###### limit?

`number`

###### offset?

`number`

#### Returns

`Promise`\<\{ `memberships`: [`ClerkOrganizationMembership`](/api/auth-clerk/src/type-aliases/clerkorganizationmembership/)[]; `totalCount`: `number`; \}\>

***

### revokeOrganizationInvitation()

> **revokeOrganizationInvitation**(`organizationId`, `invitationId`): `Promise`\<[`ClerkOrganizationInvitation`](/api/auth-clerk/src/type-aliases/clerkorganizationinvitation/)\>

#### Parameters

##### organizationId

`string`

##### invitationId

`string`

#### Returns

`Promise`\<[`ClerkOrganizationInvitation`](/api/auth-clerk/src/type-aliases/clerkorganizationinvitation/)\>

***

### updateOrganization()

> **updateOrganization**(`organizationId`, `input`): `Promise`\<[`ClerkOrganization`](/api/auth-clerk/src/type-aliases/clerkorganization/)\>

#### Parameters

##### organizationId

`string`

##### input

[`UpdateOrganizationInput`](/api/auth-clerk/src/type-aliases/updateorganizationinput/)

#### Returns

`Promise`\<[`ClerkOrganization`](/api/auth-clerk/src/type-aliases/clerkorganization/)\>

***

### updateOrganizationMembership()

> **updateOrganizationMembership**(`organizationId`, `userId`, `role`): `Promise`\<[`ClerkOrganizationMembership`](/api/auth-clerk/src/type-aliases/clerkorganizationmembership/)\>

#### Parameters

##### organizationId

`string`

##### userId

`string`

##### role

`string`

#### Returns

`Promise`\<[`ClerkOrganizationMembership`](/api/auth-clerk/src/type-aliases/clerkorganizationmembership/)\>
