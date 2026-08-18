---
editUrl: false
next: false
prev: false
title: "ClerkUserService"
---

Clerk 사용자 조회, 생성, 수정, 밴 관리를 제공하는 서비스입니다.

## Constructors

### Constructor

> **new ClerkUserService**(`options`): `ClerkUserService`

#### Parameters

##### options

[`ClerkAuthOptions`](/api/auth-clerk/src/type-aliases/clerkauthoptions/)

#### Returns

`ClerkUserService`

## Methods

### banUser()

> **banUser**(`userId`): `Promise`\<[`ClerkUser`](/api/auth-clerk/src/type-aliases/clerkuser/)\>

#### Parameters

##### userId

`string`

#### Returns

`Promise`\<[`ClerkUser`](/api/auth-clerk/src/type-aliases/clerkuser/)\>

---

### createUser()

> **createUser**(`input`): `Promise`\<[`ClerkUser`](/api/auth-clerk/src/type-aliases/clerkuser/)\>

#### Parameters

##### input

[`CreateClerkUserInput`](/api/auth-clerk/src/type-aliases/createclerkuserinput/)

#### Returns

`Promise`\<[`ClerkUser`](/api/auth-clerk/src/type-aliases/clerkuser/)\>

---

### deleteUser()

> **deleteUser**(`userId`): `Promise`\<`void`\>

#### Parameters

##### userId

`string`

#### Returns

`Promise`\<`void`\>

---

### getUser()

> **getUser**(`userId`): `Promise`\<[`ClerkUser`](/api/auth-clerk/src/type-aliases/clerkuser/) \| `null`\>

#### Parameters

##### userId

`string`

#### Returns

`Promise`\<[`ClerkUser`](/api/auth-clerk/src/type-aliases/clerkuser/) \| `null`\>

---

### getUserList()

> **getUserList**(`options?`): `Promise`\<[`UserListResult`](/api/auth-clerk/src/type-aliases/userlistresult/)\>

#### Parameters

##### options?

[`UserListOptions`](/api/auth-clerk/src/type-aliases/userlistoptions/) = `{}`

#### Returns

`Promise`\<[`UserListResult`](/api/auth-clerk/src/type-aliases/userlistresult/)\>

---

### unbanUser()

> **unbanUser**(`userId`): `Promise`\<[`ClerkUser`](/api/auth-clerk/src/type-aliases/clerkuser/)\>

#### Parameters

##### userId

`string`

#### Returns

`Promise`\<[`ClerkUser`](/api/auth-clerk/src/type-aliases/clerkuser/)\>

---

### updateUser()

> **updateUser**(`userId`, `input`): `Promise`\<[`ClerkUser`](/api/auth-clerk/src/type-aliases/clerkuser/)\>

#### Parameters

##### userId

`string`

##### input

[`UpdateClerkUserInput`](/api/auth-clerk/src/type-aliases/updateclerkuserinput/)

#### Returns

`Promise`\<[`ClerkUser`](/api/auth-clerk/src/type-aliases/clerkuser/)\>

---

### updateUserMetadata()

> **updateUserMetadata**(`userId`, `metadata`): `Promise`\<[`ClerkUser`](/api/auth-clerk/src/type-aliases/clerkuser/)\>

#### Parameters

##### userId

`string`

##### metadata

###### privateMetadata?

`Record`\<`string`, `unknown`\>

###### publicMetadata?

`Record`\<`string`, `unknown`\>

#### Returns

`Promise`\<[`ClerkUser`](/api/auth-clerk/src/type-aliases/clerkuser/)\>
