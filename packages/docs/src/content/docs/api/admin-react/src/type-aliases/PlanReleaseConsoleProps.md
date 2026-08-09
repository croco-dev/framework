---
editUrl: false
next: false
prev: false
title: "PlanReleaseConsoleProps"
---

> **PlanReleaseConsoleProps** = `object`

## Properties

### command?

> `readonly` `optional` **command?**: `Omit`\<[`PlanReleaseActionRequest`](/api/admin-react/src/type-aliases/planreleaseactionrequest/), `"actionId"` \| `"expectedReleaseRevision"`\>

***

### onAction?

> `readonly` `optional` **onAction?**: (`action`, `request`) => `void`

#### Parameters

##### action

[`PlanReleaseAdminAction`](/api/admin-react/src/type-aliases/planreleaseadminaction/)

##### request

[`PlanReleaseActionRequest`](/api/admin-react/src/type-aliases/planreleaseactionrequest/)

#### Returns

`void`

***

### onCancelConfirmation?

> `readonly` `optional` **onCancelConfirmation?**: () => `void`

#### Returns

`void`

***

### onEdit?

> `readonly` `optional` **onEdit?**: (`request`) => `void`

#### Parameters

##### request

[`PlanReleaseEditRequest`](/api/admin-react/src/type-aliases/planreleaseeditrequest/)

#### Returns

`void`

***

### onRequestConfirmation?

> `readonly` `optional` **onRequestConfirmation?**: (`action`) => `void`

#### Parameters

##### action

[`PlanReleaseAdminAction`](/api/admin-react/src/type-aliases/planreleaseadminaction/)

#### Returns

`void`

***

### pendingConfirmationActionId?

> `readonly` `optional` **pendingConfirmationActionId?**: `string`

***

### state

> `readonly` **state**: [`PlanReleaseConsoleState`](/api/admin-react/src/type-aliases/planreleaseconsolestate/)
