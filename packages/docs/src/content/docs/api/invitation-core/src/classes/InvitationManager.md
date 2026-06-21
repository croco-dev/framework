---
editUrl: false
next: false
prev: false
title: "InvitationManager"
---

초대 생성, 수락, 거절, 취소, 재전송을 담당하는 핵심 서비스입니다.

## Constructors

### Constructor

> **new InvitationManager**(`store`, `membershipManager`, `notificationService`, `eventPublisher`, `txManager`): `InvitationManager`

#### Parameters

##### store

[`InvitationStore`](/api/invitation-core/src/classes/invitationstore/)

##### membershipManager

[`AbstractMembershipManager`](/api/membership-core/src/classes/abstractmembershipmanager/)

##### notificationService

[`NotificationService`](/api/notifications-core/src/classes/notificationservice/)

##### eventPublisher

[`EventPublisher`](/api/events-core/src/classes/eventpublisher/)

##### txManager

[`TxManager`](/api/tx-core/src/classes/txmanager/)\<`unknown`\>

#### Returns

`InvitationManager`

## Methods

### acceptInvitation()

> **acceptInvitation**(`input`): `Promise`\<[`Invitation`](/api/invitation-core/src/type-aliases/invitation/)\>

#### Parameters

##### input

[`AcceptInvitationInput`](/api/invitation-core/src/type-aliases/acceptinvitationinput/)

#### Returns

`Promise`\<[`Invitation`](/api/invitation-core/src/type-aliases/invitation/)\>

***

### createEmailInvitation()

> **createEmailInvitation**(`input`): `Promise`\<`string`\>

#### Parameters

##### input

[`CreateEmailInvitationInput`](/api/invitation-core/src/type-aliases/createemailinvitationinput/)

#### Returns

`Promise`\<`string`\>

***

### createLinkInvitation()

> **createLinkInvitation**(`input`): `Promise`\<`string`\>

#### Parameters

##### input

[`CreateLinkInvitationInput`](/api/invitation-core/src/type-aliases/createlinkinvitationinput/)

#### Returns

`Promise`\<`string`\>

***

### declineInvitation()

> **declineInvitation**(`token`): `Promise`\<[`Invitation`](/api/invitation-core/src/type-aliases/invitation/)\>

#### Parameters

##### token

`string`

#### Returns

`Promise`\<[`Invitation`](/api/invitation-core/src/type-aliases/invitation/)\>

***

### resendInvitation()

> **resendInvitation**(`invitationId`): `Promise`\<`string`\>

#### Parameters

##### invitationId

`string`

#### Returns

`Promise`\<`string`\>

***

### revokeInvitation()

> **revokeInvitation**(`invitationId`): `Promise`\<[`Invitation`](/api/invitation-core/src/type-aliases/invitation/)\>

#### Parameters

##### invitationId

`string`

#### Returns

`Promise`\<[`Invitation`](/api/invitation-core/src/type-aliases/invitation/)\>
