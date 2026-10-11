---
"@croco/admin-react": minor
---

Cursor pagination keeps its declared page size when navigating full, short, or empty pages. Pass `{ limit }` as the required second argument to `createAdminDataTableListResultFromCursorPage(page, { limit })`, and include `limit` in cursor pagination summaries. Missing or invalid page sizes produce an `admin-table/invalid-pagination-limit` Problem state instead of deriving the next request size from rendered rows.
