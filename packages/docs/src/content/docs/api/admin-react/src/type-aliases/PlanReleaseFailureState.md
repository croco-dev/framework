---
editUrl: false
next: false
prev: false
title: "PlanReleaseFailureState"
---

> **PlanReleaseFailureState** = `object`

## Properties

### kind

> `readonly` **kind**: `"permission-denied"` \| `"provider-failure"` \| `"problem"`

***

### problem

> `readonly` **problem**: [`ProblemDetails`](/api/problems-core/src/type-aliases/problemdetails/)

***

### recoveryActions

> `readonly` **recoveryActions**: readonly [`PlanReleaseAdminAction`](/api/admin-react/src/type-aliases/planreleaseadminaction/)[]

***

### snapshot?

> `readonly` `optional` **snapshot?**: [`PlanReleaseConsoleSnapshot`](/api/admin-react/src/type-aliases/planreleaseconsolesnapshot/)
