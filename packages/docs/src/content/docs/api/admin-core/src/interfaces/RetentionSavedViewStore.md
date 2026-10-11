---
editUrl: false
next: false
prev: false
title: "RetentionSavedViewStore"
---

## Methods

### read()

> **read**(`scope`, `subjectKind`, `id`): `Promise`\<[`RetentionSavedView`](/api/admin-core/src/type-aliases/retentionsavedview/) \| `undefined`\>

#### Parameters

##### scope

[`BehaviorScope`](/api/metrics-core/src/type-aliases/behaviorscope/)

##### subjectKind

`string`

##### id

`string`

#### Returns

`Promise`\<[`RetentionSavedView`](/api/admin-core/src/type-aliases/retentionsavedview/) \| `undefined`\>

---

### write()

> **write**(`scope`, `subjectKind`, `record`): `Promise`\<`void`\>

#### Parameters

##### scope

[`BehaviorScope`](/api/metrics-core/src/type-aliases/behaviorscope/)

##### subjectKind

`string`

##### record

[`RetentionSavedView`](/api/admin-core/src/type-aliases/retentionsavedview/)

#### Returns

`Promise`\<`void`\>
