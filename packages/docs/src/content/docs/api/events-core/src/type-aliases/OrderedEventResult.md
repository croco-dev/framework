---
editUrl: false
next: false
prev: false
title: "OrderedEventResult"
---

> **OrderedEventResult** = `object`

순서 보장 이벤트 처리 결과입니다.

## Properties

### error?

> `optional` **error?**: `Error`

에러 (실패한 경우)

---

### eventId

> **eventId**: `string`

처리된 이벤트 ID

---

### processedAt

> **processedAt**: `Date`

처리 시간

---

### sequence

> **sequence**: `number`

처리 순서 (파티션 내에서의 순서)

---

### success

> **success**: `boolean`

처리 성공 여부
