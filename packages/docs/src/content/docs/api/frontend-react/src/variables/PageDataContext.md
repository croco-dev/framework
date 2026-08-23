---
editUrl: false
next: false
prev: false
title: "PageDataContext"
---

> `const` **PageDataContext**: `Context`\<`PageDataContextValue`\>

Internal React context that carries SSR page data and page metadata from the
generated entrypoint to Croco page hooks.

App code normally wraps the root component with `PageDataProvider` instead of
reading this context directly. Advanced integrations can provide the same
shape when they bridge a custom renderer into Croco page data hooks.
