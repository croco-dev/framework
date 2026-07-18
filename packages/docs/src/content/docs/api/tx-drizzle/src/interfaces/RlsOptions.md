---
editUrl: false
next: false
prev: false
title: "RlsOptions"
---

## Properties

### configKey?

> `optional` **configKey?**: `string`

The configuration parameter name to use for RLS.

#### Default

```ts
"app.current_tenant";
```

---

### debug?

> `optional` **debug?**: `boolean`

If true, logs when RLS variable is set.

#### Default

```ts
false;
```

---

### logger?

> `optional` **logger?**: [`RlsLogger`](/api/tx-drizzle/src/type-aliases/rlslogger/)

Logger used for RLS diagnostics. When omitted, the framework logger is resolved from the container.
Debug-enabled adapters fail during creation if neither source provides a usable logger.
