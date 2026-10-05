---
editUrl: false
next: false
prev: false
title: "ReminderOperationsState"
---

> **ReminderOperationsState** = \{ `kind`: `"loading"` \| `"empty"`; \} \| \{ `kind`: `"denied"` \| `"error"`; `message`: `string`; \} \| \{ `kind`: `"ready"` \| `"partial"`; `message?`: `string`; `rows`: readonly [`ReminderOperationsRow`](/api/admin-core/src/type-aliases/reminderoperationsrow/)[]; \}
