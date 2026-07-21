---
editUrl: false
next: false
prev: false
title: "AutoInstrumentationConfig"
---

Configuration for auto-instrumentation.
Defines which modules should be automatically instrumented.

## Example

```typescript
const autoInstrumentConfig: AutoInstrumentationConfig = {
  enabled: true,
  modules: ["http", "https", "express", "pg"],
};
```

## Properties

### customInstrumentations?

> `optional` **customInstrumentations?**: `Instrumentation`\<`InstrumentationConfig`\>[]

Custom instrumentation instances to include.
These are merged with auto-loaded instrumentations.

---

### enabled?

> `optional` **enabled?**: `boolean`

Whether auto-instrumentation is enabled.

#### Default

```ts
true;
```

---

### ~~exclude?~~

> `optional` **exclude?**: `string`[]

Unsupported operation exclusion filters.
Non-empty values fail SDK startup because the Node instrumentation bundle cannot apply them
consistently across modules.

:::caution[Deprecated]
Use module-specific supported options or custom instrumentation instances.
:::

---

### excludeModules?

> `optional` **excludeModules?**: [`AutoInstrumentationModule`](/api/telemetry-sdk-node/src/type-aliases/autoinstrumentationmodule/)[]

List of modules to exclude from auto-instrumentation.
Takes precedence over 'modules'.

---

### ~~include?~~

> `optional` **include?**: `string`[]

Unsupported operation inclusion filters.
Non-empty values fail SDK startup because the Node instrumentation bundle cannot apply them
consistently across modules.

:::caution[Deprecated]
Use module-specific supported options or custom instrumentation instances.
:::

---

### moduleOptions?

> `optional` **moduleOptions?**: `Record`\<`string`, `Record`\<`string`, `unknown`\>\>

Configuration for specific instrumentations.
Keys are module names, values are module-specific options.

---

### modules?

> `optional` **modules?**: [`AutoInstrumentationModule`](/api/telemetry-sdk-node/src/type-aliases/autoinstrumentationmodule/)[]

List of modules to auto-instrument.
If not specified, all available modules will be instrumented.
