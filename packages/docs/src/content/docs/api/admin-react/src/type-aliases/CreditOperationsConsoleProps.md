---
editUrl: false
next: false
prev: false
title: "CreditOperationsConsoleProps"
---

> **CreditOperationsConsoleProps** = `object`

## Properties

### filter?

> `readonly` `optional` **filter?**: [`CreditOperationsFilter`](/api/admin-core/src/type-aliases/creditoperationsfilter/)

***

### onAction?

> `readonly` `optional` **onAction?**: (`action`) => `void`

#### Parameters

##### action

[`CreditOperationsAction`](/api/admin-core/src/type-aliases/creditoperationsaction/)

#### Returns

`void`

***

### onFilterChange?

> `readonly` `optional` **onFilterChange?**: (`filter`) => `void`

#### Parameters

##### filter

[`CreditOperationsFilter`](/api/admin-core/src/type-aliases/creditoperationsfilter/)

#### Returns

`void`

***

### onRefresh?

> `readonly` `optional` **onRefresh?**: () => `void`

#### Returns

`void`

***

### onSelectReservation?

> `readonly` `optional` **onSelectReservation?**: (`reservationId`) => `void`

#### Parameters

##### reservationId

`string`

#### Returns

`void`

***

### onSelectTransaction?

> `readonly` `optional` **onSelectTransaction?**: (`transactionId`) => `void`

#### Parameters

##### transactionId

`string`

#### Returns

`void`

***

### selectedReservationId?

> `readonly` `optional` **selectedReservationId?**: `string`

***

### selectedTransactionId?

> `readonly` `optional` **selectedTransactionId?**: `string`

***

### state

> `readonly` **state**: [`CreditOperationsState`](/api/admin-core/src/type-aliases/creditoperationsstate/)
