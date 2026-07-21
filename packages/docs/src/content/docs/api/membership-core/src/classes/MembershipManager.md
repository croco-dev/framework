---
editUrl: false
next: false
prev: false
title: "MembershipManager"
---

멤버십 관리자

## Description

멤버십 라이프사이클을 관리하는 매니저입니다.
- 역할 계층 검증 (owner > admin > member > viewer)
- 소유권 보호 (마지막 소유자 제거/강등 방지)
- 소유권 이전 지원
- 좌석 제한 통합

## Example

**매니저 사용**

```typescript
const manager = new MembershipManager(store, eventPublisher, seatLimitChecker);

// 멤버 추가
await manager.addMember('tenant-123', 'user-456', 'admin');

// 역할 변경
await manager.updateRole('tenant-123', 'user-456', 'owner');

// 소유권 이전
await manager.transferOwnership('tenant-123', 'current-owner', 'new-owner');

// 멤버 제거
await manager.removeMember('tenant-123', 'user-456');
```

## Implements

- [`AbstractMembershipManager`](/api/membership-core/src/classes/abstractmembershipmanager/)

## Constructors

### Constructor

> **new MembershipManager**(`store`, `eventPublisher`, `seatLimitChecker?`): `MembershipManager`

#### Parameters

##### store

[`MembershipStore`](/api/membership-core/src/classes/membershipstore/)

##### eventPublisher

[`EventPublisher`](/api/events-core/src/classes/eventpublisher/)

##### seatLimitChecker?

[`SeatLimitChecker`](/api/membership-core/src/classes/seatlimitchecker/) \| `undefined`

#### Returns

`MembershipManager`

## Methods

### addMember()

> **addMember**(`tenantId`, `userId`, `role`): `Promise`\<[`Membership`](/api/membership-core/src/type-aliases/membership/)\>

#### Parameters

##### tenantId

`string`

##### userId

`string`

##### role

[`MembershipRole`](/api/membership-core/src/type-aliases/membershiprole/)

#### Returns

`Promise`\<[`Membership`](/api/membership-core/src/type-aliases/membership/)\>

#### Implementation of

[`AbstractMembershipManager`](/api/membership-core/src/classes/abstractmembershipmanager/).[`addMember`](/api/membership-core/src/classes/abstractmembershipmanager/#addmember)

***

### getMember()

> **getMember**(`tenantId`, `userId`): `Promise`\<[`Membership`](/api/membership-core/src/type-aliases/membership/)\>

#### Parameters

##### tenantId

`string`

##### userId

`string`

#### Returns

`Promise`\<[`Membership`](/api/membership-core/src/type-aliases/membership/)\>

#### Implementation of

[`AbstractMembershipManager`](/api/membership-core/src/classes/abstractmembershipmanager/).[`getMember`](/api/membership-core/src/classes/abstractmembershipmanager/#getmember)

***

### listMembers()

> **listMembers**(`tenantId`): `Promise`\<[`Membership`](/api/membership-core/src/type-aliases/membership/)[]\>

#### Parameters

##### tenantId

`string`

#### Returns

`Promise`\<[`Membership`](/api/membership-core/src/type-aliases/membership/)[]\>

#### Implementation of

[`AbstractMembershipManager`](/api/membership-core/src/classes/abstractmembershipmanager/).[`listMembers`](/api/membership-core/src/classes/abstractmembershipmanager/#listmembers)

***

### listTenants()

> **listTenants**(`userId`): `Promise`\<[`Membership`](/api/membership-core/src/type-aliases/membership/)[]\>

#### Parameters

##### userId

`string`

#### Returns

`Promise`\<[`Membership`](/api/membership-core/src/type-aliases/membership/)[]\>

#### Implementation of

[`AbstractMembershipManager`](/api/membership-core/src/classes/abstractmembershipmanager/).[`listTenants`](/api/membership-core/src/classes/abstractmembershipmanager/#listtenants)

***

### removeMember()

> **removeMember**(`tenantId`, `userId`): `Promise`\<`void`\>

#### Parameters

##### tenantId

`string`

##### userId

`string`

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`AbstractMembershipManager`](/api/membership-core/src/classes/abstractmembershipmanager/).[`removeMember`](/api/membership-core/src/classes/abstractmembershipmanager/#removemember)

***

### transferOwnership()

> **transferOwnership**(`tenantId`, `fromUserId`, `toUserId`): `Promise`\<`void`\>

#### Parameters

##### tenantId

`string`

##### fromUserId

`string`

##### toUserId

`string`

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`AbstractMembershipManager`](/api/membership-core/src/classes/abstractmembershipmanager/).[`transferOwnership`](/api/membership-core/src/classes/abstractmembershipmanager/#transferownership)

***

### updateRole()

> **updateRole**(`tenantId`, `userId`, `newRole`): `Promise`\<[`Membership`](/api/membership-core/src/type-aliases/membership/)\>

#### Parameters

##### tenantId

`string`

##### userId

`string`

##### newRole

[`MembershipRole`](/api/membership-core/src/type-aliases/membershiprole/)

#### Returns

`Promise`\<[`Membership`](/api/membership-core/src/type-aliases/membership/)\>

#### Implementation of

[`AbstractMembershipManager`](/api/membership-core/src/classes/abstractmembershipmanager/).[`updateRole`](/api/membership-core/src/classes/abstractmembershipmanager/#updaterole)
