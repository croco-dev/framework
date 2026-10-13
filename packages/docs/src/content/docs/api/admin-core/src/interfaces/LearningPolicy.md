---
editUrl: false
next: false
prev: false
title: "LearningPolicy"
---

Host policy is re-evaluated on every operation, including history, receipt replay and export.

## Methods

### assertSafe()

> **assertSafe**(`content`, `access`, `reason?`): `Promise`\<`void`\>

Reject sensitive customer text before persistence; never silently accept unreviewed imports.

#### Parameters

##### content

[`LearningContent`](/api/admin-core/src/type-aliases/learningcontent/)

##### access

[`LearningAccess`](/api/admin-core/src/type-aliases/learningaccess/)

##### reason?

`string`

#### Returns

`Promise`\<`void`\>

---

### authorize()

> **authorize**(`access`, `permission`): `Promise`\<`boolean`\>

#### Parameters

##### access

[`LearningAccess`](/api/admin-core/src/type-aliases/learningaccess/)

##### permission

[`LearningPermission`](/api/admin-core/src/type-aliases/learningpermission/)

#### Returns

`Promise`\<`boolean`\>

---

### fields()

> **fields**(`access`, `permission`): `Promise`\<readonly (`"status"` \| `"question"` \| `"desiredOutcome"` \| `"facts"` \| `"hypotheses"` \| `"evidenceRefs"` \| `"decision"` \| `"nextActions"` \| `"owner"` \| `"tags"`)[]\>

#### Parameters

##### access

[`LearningAccess`](/api/admin-core/src/type-aliases/learningaccess/)

##### permission

[`LearningPermission`](/api/admin-core/src/type-aliases/learningpermission/)

#### Returns

`Promise`\<readonly (`"status"` \| `"question"` \| `"desiredOutcome"` \| `"facts"` \| `"hypotheses"` \| `"evidenceRefs"` \| `"decision"` \| `"nextActions"` \| `"owner"` \| `"tags"`)[]\>
