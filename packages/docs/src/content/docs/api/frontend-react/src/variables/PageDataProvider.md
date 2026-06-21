---
editUrl: false
next: false
prev: false
title: "PageDataProvider"
---

> `const` **PageDataProvider**: `Provider`\<`PageDataContextValue`\> = `PageDataContext.Provider`

React provider for the Croco page data pattern.

Place this provider at the browser hydration or SSR entrypoint so descendants
can call `usePageData<T>()` for route data and `usePageMeta()` for title,
description, and original URL metadata.

## Example

```tsx
<PageDataProvider value={{ data: { message: "ready" }, title: "Home" }}>
  <Page />
</PageDataProvider>
```
