---
editUrl: false
next: false
prev: false
title: "NotificationTemplate"
---

> **NotificationTemplate** = [`NotificationTemplateRef`](/api/notifications-core/src/type-aliases/notificationtemplateref/) & `object` & \{ `channel`: [`PUSH`](/api/notifications-core/src/enumerations/notificationchannel/#push); `push?`: `Omit`\<[`PushContent`](/api/engagement-core/src/type-aliases/pushcontent/), `"title"` \| `"body"`\>; `subject`: `string`; \} \| \{ `channel`: `Exclude`\<[`NotificationChannel`](/api/notifications-core/src/enumerations/notificationchannel/), [`PUSH`](/api/notifications-core/src/enumerations/notificationchannel/#push)\>; `push?`: `never`; `subject?`: `string`; \}

## Type Declaration

### content

> `readonly` **content**: `string`

### variableEscaping?

> `readonly` `optional` **variableEscaping?**: [`NotificationTemplateVariableEscaping`](/api/notifications-core/src/type-aliases/notificationtemplatevariableescaping/)

### variablesSchema?

> `readonly` `optional` **variablesSchema?**: [`NotificationTemplateVariablesSchema`](/api/notifications-core/src/type-aliases/notificationtemplatevariablesschema/)
