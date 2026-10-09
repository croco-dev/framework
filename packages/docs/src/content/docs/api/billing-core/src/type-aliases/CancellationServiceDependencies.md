---
editUrl: false
next: false
prev: false
title: "CancellationServiceDependencies"
---

> **CancellationServiceDependencies** = `object`

## Properties

### actions

> `readonly` **actions**: readonly [`CancellationAction`](/api/billing-core/src/interfaces/cancellationaction/)[]

---

### authority

> `readonly` **authority**: [`CancellationAuthority`](/api/billing-core/src/interfaces/cancellationauthority/)

---

### choices

> `readonly` **choices**: readonly [`RegisteredCancellationChoice`](/api/billing-core/src/type-aliases/registeredcancellationchoice/)[]

---

### clock?

> `readonly` `optional` **clock?**: () => `Date`

#### Returns

`Date`

---

### store

> `readonly` **store**: [`CancellationStore`](/api/billing-core/src/interfaces/cancellationstore/)
