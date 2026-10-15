---
"@croco/protocols-graphql": patch
---

Preserve interceptor declaration order in GraphQL contract snapshots so response-changing reordering is reported as breaking drift. Regenerate and review existing v2 baselines that previously sorted interceptor names.
