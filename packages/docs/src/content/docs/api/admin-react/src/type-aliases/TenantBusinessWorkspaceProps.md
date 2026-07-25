---
editUrl: false
next: false
prev: false
title: "TenantBusinessWorkspaceProps"
---

> **TenantBusinessWorkspaceProps** = `object`

## Properties

### actionResult?

> `readonly` `optional` **actionResult?**: [`TenantWorkspaceActionResult`](/api/admin-react/src/type-aliases/tenantworkspaceactionresult/)

---

### activeSection?

> `readonly` `optional` **activeSection?**: [`TenantWorkspaceSectionId`](/api/admin-core/src/type-aliases/tenantworkspacesectionid/)

---

### onAction?

> `readonly` `optional` **onAction?**: (`request`) => `void`

#### Parameters

##### request

[`TenantWorkspaceActionRequest`](/api/admin-react/src/type-aliases/tenantworkspaceactionrequest/)

#### Returns

`void`

---

### onRefreshSource?

> `readonly` `optional` **onRefreshSource?**: (`sourceId`) => `void`

#### Parameters

##### sourceId

`string`

#### Returns

`void`

---

### onSectionChange?

> `readonly` `optional` **onSectionChange?**: (`section`) => `void`

#### Parameters

##### section

[`TenantWorkspaceSectionId`](/api/admin-core/src/type-aliases/tenantworkspacesectionid/)

#### Returns

`void`

---

### renderExtension?

> `readonly` `optional` **renderExtension?**: (`extension`) => `ReactNode`

#### Parameters

##### extension

[`TenantWorkspaceExtension`](/api/admin-core/src/type-aliases/tenantworkspaceextension/)

#### Returns

`ReactNode`

---

### state

> `readonly` **state**: [`TenantWorkspaceSnapshot`](/api/admin-core/src/type-aliases/tenantworkspacesnapshot/)
