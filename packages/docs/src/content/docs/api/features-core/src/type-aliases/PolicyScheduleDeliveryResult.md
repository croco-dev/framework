---
editUrl: false
next: false
prev: false
title: "PolicyScheduleDeliveryResult"
---

> **PolicyScheduleDeliveryResult** = `object`

## Properties

### executionId?

> `readonly` `optional` **executionId?**: `string`

---

### receipt?

> `readonly` `optional` **receipt?**: [`PolicyCommandReceipt`](/api/features-core/src/type-aliases/policycommandreceipt/)

---

### schedule

> `readonly` **schedule**: [`PolicyScheduleRecord`](/api/features-core/src/type-aliases/policyschedulerecord/)

---

### state

> `readonly` **state**: `"completed"` \| `"duplicate"` \| `"claimed"`
