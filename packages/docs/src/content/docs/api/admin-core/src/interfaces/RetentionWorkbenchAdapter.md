---
editUrl: false
next: false
prev: false
title: "RetentionWorkbenchAdapter"
---

## Methods

### authorize()

> **authorize**(`input`): `Promise`\<`boolean`\>

#### Parameters

##### input

###### permission

[`RetentionPermission`](/api/admin-core/src/type-aliases/retentionpermission/)

###### savedViewId?

`string`

###### scope

[`BehaviorScope`](/api/metrics-core/src/type-aliases/behaviorscope/)

###### subjectKind

`string`

#### Returns

`Promise`\<`boolean`\>

---

### read()

> **read**(`input`): `Promise`\<[`BehaviorDataset`](/api/metrics-core/src/type-aliases/behaviordataset/)\>

Fetch at most limit normalized observations; never silently truncate a complete dataset.

#### Parameters

##### input

###### definition

[`BehaviorDefinition`](/api/metrics-core/src/type-aliases/behaviordefinition/)

###### limit

`number`

###### scope

[`BehaviorScope`](/api/metrics-core/src/type-aliases/behaviorscope/)

###### sourceRef?

`string`

#### Returns

`Promise`\<[`BehaviorDataset`](/api/metrics-core/src/type-aliases/behaviordataset/)\>

---

### subjectLabel()

> **subjectLabel**(`input`): `Promise`\<`string`\>

Return a stable opaque reference or masked display label; never raw PII. Called only after drilldown authorization.

#### Parameters

##### input

###### scope

[`BehaviorScope`](/api/metrics-core/src/type-aliases/behaviorscope/)

###### subjectId

`string`

###### subjectKind

`string`

#### Returns

`Promise`\<`string`\>
