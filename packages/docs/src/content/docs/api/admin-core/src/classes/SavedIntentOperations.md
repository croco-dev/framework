---
editUrl: false
next: false
prev: false
title: "SavedIntentOperations"
---

Server adapter. Access must come from the verified server session, never the request body.

## Constructors

### Constructor

> **new SavedIntentOperations**(`service`): `SavedIntentOperations`

#### Parameters

##### service

[`SavedIntentService`](/api/experience-core/src/interfaces/savedintentservice/)

#### Returns

`SavedIntentOperations`

## Methods

### inspect()

> **inspect**(`subject`, `access`, `page?`): `Promise`\<`Readonly`\<\{ `exclusions`: readonly `Readonly`\<\{ `intentId`: `string`; `reason`: `string`; `resourceType`: `string`; \}\>[]; `nextOffset?`: `number`; `rows`: readonly `Readonly`\<\{ `availability`: `"expired"` \| `"available"` \| `"denied"` \| `"deleted"`; `intentId`: `string`; `rankReason`: `"pinned"` \| `"recent"`; `resourceType`: `string`; \}\>[]; \}\>\>

#### Parameters

##### subject

[`ExperienceSubject`](/api/experience-core/src/type-aliases/experiencesubject/)

##### access

[`SavedIntentAdminAccess`](/api/admin-core/src/type-aliases/savedintentadminaccess/)

##### page?

`Readonly`\<\{ `limit?`: `number`; `offset?`: `number`; \}\> = `{}`

#### Returns

`Promise`\<`Readonly`\<\{ `exclusions`: readonly `Readonly`\<\{ `intentId`: `string`; `reason`: `string`; `resourceType`: `string`; \}\>[]; `nextOffset?`: `number`; `rows`: readonly `Readonly`\<\{ `availability`: `"expired"` \| `"available"` \| `"denied"` \| `"deleted"`; `intentId`: `string`; `rankReason`: `"pinned"` \| `"recent"`; `resourceType`: `string`; \}\>[]; \}\>\>

---

### readPolicy()

> **readPolicy**(`resourceType`, `subject`, `access`): `Promise`\<`Readonly`\<\{ `actorId`: `string`; `displayLimit`: `number`; `excludeCompleted`: `boolean`; `reason`: `string`; `resourceType`: `string`; `retentionDays`: `number`; `revision`: `number`; `scope`: [`ExperienceScope`](/api/experience-core/src/type-aliases/experiencescope/); `updatedAt`: `string`; \}\>\>

#### Parameters

##### resourceType

`string`

##### subject

[`ExperienceSubject`](/api/experience-core/src/type-aliases/experiencesubject/)

##### access

[`SavedIntentAdminAccess`](/api/admin-core/src/type-aliases/savedintentadminaccess/)

#### Returns

`Promise`\<`Readonly`\<\{ `actorId`: `string`; `displayLimit`: `number`; `excludeCompleted`: `boolean`; `reason`: `string`; `resourceType`: `string`; `retentionDays`: `number`; `revision`: `number`; `scope`: [`ExperienceScope`](/api/experience-core/src/type-aliases/experiencescope/); `updatedAt`: `string`; \}\>\>

---

### updatePolicy()

> **updatePolicy**(`input`, `access`): `Promise`\<`Readonly`\<\{ `actorId`: `string`; `displayLimit`: `number`; `excludeCompleted`: `boolean`; `reason`: `string`; `resourceType`: `string`; `retentionDays`: `number`; `revision`: `number`; `scope`: [`ExperienceScope`](/api/experience-core/src/type-aliases/experiencescope/); `updatedAt`: `string`; \}\>\>

#### Parameters

##### input

`Omit`\<[`SavedIntentPolicyInput`](/api/experience-core/src/type-aliases/savedintentpolicyinput/), `"principal"` \| `"actorId"`\>

##### access

[`SavedIntentAdminAccess`](/api/admin-core/src/type-aliases/savedintentadminaccess/)

#### Returns

`Promise`\<`Readonly`\<\{ `actorId`: `string`; `displayLimit`: `number`; `excludeCompleted`: `boolean`; `reason`: `string`; `resourceType`: `string`; `retentionDays`: `number`; `revision`: `number`; `scope`: [`ExperienceScope`](/api/experience-core/src/type-aliases/experiencescope/); `updatedAt`: `string`; \}\>\>
