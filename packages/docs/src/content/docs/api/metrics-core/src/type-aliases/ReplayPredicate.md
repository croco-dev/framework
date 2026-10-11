---
editUrl: false
next: false
prev: false
title: "ReplayPredicate"
---

> **ReplayPredicate** = \{ `op`: `"all"`; \} \| \{ `op`: `"eq"` \| `"neq"` \| `"gte"` \| `"lte"`; `trait`: `string`; `value`: `Scalar`; \} \| \{ `conditions`: readonly `ReplayPredicate`[]; `op`: `"and"` \| `"or"`; \} \| \{ `condition`: `ReplayPredicate`; `op`: `"not"`; \}
