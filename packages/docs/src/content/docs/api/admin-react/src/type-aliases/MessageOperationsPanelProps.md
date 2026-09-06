---
editUrl: false
next: false
prev: false
title: "MessageOperationsPanelProps"
---

> **MessageOperationsPanelProps** = `object`

## Properties

### grantedPermissions

> `readonly` **grantedPermissions**: readonly `string`[]

---

### messages

> `readonly` **messages**: readonly [`EngagementMessageDescriptorRow`](/api/admin-core/src/type-aliases/engagementmessagedescriptorrow/)[]

---

### onPreviewMessage?

> `readonly` `optional` **onPreviewMessage?**: (`request`) => `void`

#### Parameters

##### request

[`EngagementMessagePreviewRequest`](/api/admin-core/src/type-aliases/engagementmessagepreviewrequest/)

#### Returns

`void`

---

### onSelectMessage?

> `readonly` `optional` **onSelectMessage?**: (`messageId`) => `void`

#### Parameters

##### messageId

`string`

#### Returns

`void`

---

### onTestSend?

> `readonly` `optional` **onTestSend?**: (`request`) => `void`

#### Parameters

##### request

[`EngagementTestSendRequest`](/api/admin-core/src/type-aliases/engagementtestsendrequest/)

#### Returns

`void`

---

### previewResult?

> `readonly` `optional` **previewResult?**: [`EngagementMessagePreviewResult`](/api/admin-core/src/type-aliases/engagementmessagepreviewresult/)

---

### selectedMessageId?

> `readonly` `optional` **selectedMessageId?**: `string`

---

### testSendResult?

> `readonly` `optional` **testSendResult?**: [`EngagementTestSendResult`](/api/admin-core/src/type-aliases/engagementtestsendresult/)
