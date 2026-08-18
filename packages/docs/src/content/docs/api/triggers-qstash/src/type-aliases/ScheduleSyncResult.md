---
editUrl: false
next: false
prev: false
title: "ScheduleSyncResult"
---

> **ScheduleSyncResult** = `object`

Result of a schedule sync operation.

## Properties

### applied

> `readonly` **applied**: `boolean`

---

### created

> **created**: `number`

Number of schedules created.

---

### deleted

> **deleted**: `number`

Number of schedules deleted (removed from code but still in QStash).

---

### details

> **details**: [`ScheduleSyncDetail`](/api/triggers-qstash/src/type-aliases/schedulesyncdetail/)[]

Details of all schedules processed.

---

### failed

> **failed**: `number`

---

### mode

> `readonly` **mode**: [`ScheduleSyncMode`](/api/triggers-qstash/src/type-aliases/schedulesyncmode/)

---

### skipped

> **skipped**: `number`

Number of schedules skipped (already in sync).

---

### updated

> **updated**: `number`

Number of schedules updated.
