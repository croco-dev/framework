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
  modules: ["http", "express", "pg"],
  exclude: ["http.server.request"], // Exclude specific operations
};
```

## Properties

### customInstrumentations?

> `optional` **customInstrumentations**: `Instrumentation`\<`InstrumentationConfig`\>[]

Custom instrumentation instances to include.
These are merged with auto-loaded instrumentations.

---

### enabled?

> `optional` **enabled**: `boolean`

Whether auto-instrumentation is enabled.

#### Default

```ts
true;
```

---

### exclude?

> `optional` **exclude**: `string`[]

Patterns for operation names to exclude.
Supports simple wildcards with '\*'.

#### Example

```ts
["health.check", "metrics.*"];
```

---

### excludeModules?

> `optional` **excludeModules**: [`AutoInstrumentationModule`](/api/telemetry-sdk-node/src/type-aliases/autoinstrumentationmodule/)[]

List of modules to exclude from auto-instrumentation.
Takes precedence over 'modules'.

---

### include?

> `optional` **include**: `string`[]

Patterns for operation names to include (whitelist).
If specified, only matching operations are instrumented.

#### Example

```ts
["api.*", "service.*"];
```

---

### moduleOptions?

> `optional` **moduleOptions**: `Record`\<`string`, `Record`\<`string`, `unknown`\>\>

Configuration for specific instrumentations.
Keys are module names, values are module-specific options.

---

### modules?

> `optional` **modules**: [`AutoInstrumentationModule`](/api/telemetry-sdk-node/src/type-aliases/autoinstrumentationmodule/)[]

List of modules to auto-instrument.
If not specified, all available modules will be instrumented.
