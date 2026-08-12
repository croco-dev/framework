---
editUrl: false
next: false
prev: false
title: "ScheduleSyncMode"
---

> **ScheduleSyncMode** = `"dry-run"` \| `"apply"` \| `"apply-with-orphan-cleanup"`

`apply` creates and updates schedules but preserves orphans.
`apply-with-orphan-cleanup` also deletes canonical, ownership-marked orphans.
