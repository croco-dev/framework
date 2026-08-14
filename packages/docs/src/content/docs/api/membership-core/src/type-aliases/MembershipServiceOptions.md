---
editUrl: false
next: false
prev: false
title: "MembershipServiceOptions"
---

> **MembershipServiceOptions** = `object`

## Properties

### eventDelivery?

> `readonly` `optional` **eventDelivery?**: `"development"` \| `"durable"`

---

### eventPublisher?

> `readonly` `optional` **eventPublisher?**: [`MembershipEventPublisher`](/api/membership-core/src/interfaces/membershipeventpublisher/)

---

### idGenerator?

> `readonly` `optional` **idGenerator?**: () => `string`

#### Returns

`string`

---

### seatLimitChecker?

> `readonly` `optional` **seatLimitChecker?**: [`SeatLimitChecker`](/api/membership-core/src/classes/seatlimitchecker/)

---

### store

> `readonly` **store**: [`MembershipStore`](/api/membership-core/src/classes/membershipstore/)
