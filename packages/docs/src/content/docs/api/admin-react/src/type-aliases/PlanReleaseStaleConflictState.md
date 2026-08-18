---
editUrl: false
next: false
prev: false
title: "PlanReleaseStaleConflictState"
---

> **PlanReleaseStaleConflictState** = `object`

## Properties

### kind

> `readonly` **kind**: `"stale-conflict"`

---

### latestServerSnapshot

> `readonly` **latestServerSnapshot**: [`PlanReleaseConsoleSnapshot`](/api/admin-react/src/type-aliases/planreleaseconsolesnapshot/)

---

### localDraft

> `readonly` **localDraft**: [`PlanReleaseDraft`](/api/admin-react/src/type-aliases/planreleasedraft/)

---

### problem

> `readonly` **problem**: [`ProblemDetails`](/api/problems-core/src/type-aliases/problemdetails/)

---

### recoveryActions

> `readonly` **recoveryActions**: readonly [`PlanReleaseAdminAction`](/api/admin-react/src/type-aliases/planreleaseadminaction/)[]
