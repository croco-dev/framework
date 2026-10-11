---
editUrl: false
next: false
prev: false
title: "createRetentionWorkbenchSource"
---

> **createRetentionWorkbenchSource**(`input`): `object`

Server-side execution over bounded normalized observations. Keep the adapter on the server.

## Parameters

### input

#### adapter

[`RetentionWorkbenchAdapter`](/api/admin-core/src/interfaces/retentionworkbenchadapter/)

#### definitions

readonly [`BehaviorDefinition`](/api/metrics-core/src/type-aliases/behaviordefinition/)[]

#### maxEvents

`number`

#### maxPageSize

`number`

#### savedViews?

[`RetentionSavedViewStore`](/api/admin-core/src/interfaces/retentionsavedviewstore/)

## Returns

`object`

### drilldown()

> **drilldown**(`request`, `page`): `Promise`\<[`RetentionDrilldownPage`](/api/admin-core/src/type-aliases/retentiondrilldownpage/)\>

#### Parameters

##### request

[`RetentionWorkbenchRequest`](/api/admin-core/src/type-aliases/retentionworkbenchrequest/)

##### page

###### inputToken

`string`

###### limit

`number`

###### offset

`number`

###### selectionId

`string`

#### Returns

`Promise`\<[`RetentionDrilldownPage`](/api/admin-core/src/type-aliases/retentiondrilldownpage/)\>

### load()

> **load**(`request`): `Promise`\<[`RetentionWorkbenchState`](/api/admin-core/src/type-aliases/retentionworkbenchstate/)\>

#### Parameters

##### request

[`RetentionWorkbenchRequest`](/api/admin-core/src/type-aliases/retentionworkbenchrequest/)

#### Returns

`Promise`\<[`RetentionWorkbenchState`](/api/admin-core/src/type-aliases/retentionworkbenchstate/)\>

### readSaved()

> **readSaved**(`scope`, `subjectKind`, `id`): `Promise`\<[`RetentionSavedView`](/api/admin-core/src/type-aliases/retentionsavedview/) \| `undefined`\>

#### Parameters

##### scope

[`BehaviorScope`](/api/metrics-core/src/type-aliases/behaviorscope/)

##### subjectKind

`string`

##### id

`string`

#### Returns

`Promise`\<[`RetentionSavedView`](/api/admin-core/src/type-aliases/retentionsavedview/) \| `undefined`\>

### save()

> **save**(`request`, `id`, `expectedInputToken`): `Promise`\<[`RetentionSavedView`](/api/admin-core/src/type-aliases/retentionsavedview/)\>

#### Parameters

##### request

[`RetentionWorkbenchRequest`](/api/admin-core/src/type-aliases/retentionworkbenchrequest/)

##### id

`string`

##### expectedInputToken

`string`

#### Returns

`Promise`\<[`RetentionSavedView`](/api/admin-core/src/type-aliases/retentionsavedview/)\>
