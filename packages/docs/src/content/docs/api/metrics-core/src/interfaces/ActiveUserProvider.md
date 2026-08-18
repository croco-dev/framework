---
editUrl: false
next: false
prev: false
title: "ActiveUserProvider"
---

Provider interface for computing user-related metrics (DAU, new users, churned users).
Implementations: analytics-posthog.ActiveUserProvider

## Methods

### getChurnedUsersCount()

> **getChurnedUsersCount**(`date`, `tenantId?`): `Promise`\<`number`\>

Get the number of users who churned on a specific date.

A "churned" user is defined as a user who has not generated any events
within the defined churn period (e.g., 30 days of inactivity).

#### Parameters

##### date

`Date`

The date to query churned users for

##### tenantId?

`string`

Optional tenant ID for tenant-specific aggregation. If omitted, returns aggregate across all tenants.

#### Returns

`Promise`\<`number`\>

The count of churned users

---

### getDailyActiveUsers()

> **getDailyActiveUsers**(`date`, `tenantId?`): `Promise`\<`number`\>

Get the number of daily active users for a specific date.

An "active" user is defined as a user who has generated at least one event
within the last 24 hours from the given date.

#### Parameters

##### date

`Date`

The date to query active users for

##### tenantId?

`string`

Optional tenant ID for tenant-specific aggregation. If omitted, returns aggregate across all tenants.

#### Returns

`Promise`\<`number`\>

The count of active users

---

### getNewUsersCount()

> **getNewUsersCount**(`date`, `tenantId?`): `Promise`\<`number`\>

Get the number of new users who joined on a specific date.

#### Parameters

##### date

`Date`

The date to query new users for

##### tenantId?

`string`

Optional tenant ID for tenant-specific aggregation. If omitted, returns aggregate across all tenants.

#### Returns

`Promise`\<`number`\>

The count of new users
