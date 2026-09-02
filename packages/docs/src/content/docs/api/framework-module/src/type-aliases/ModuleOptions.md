---
editUrl: false
next: false
prev: false
title: "ModuleOptions"
---

> **ModuleOptions** = `object`

## Properties

### contributions?

> `readonly` `optional` **contributions?**: readonly [`ModuleContribution`](/api/framework-module/src/type-aliases/modulecontribution/)[]

Deterministically ordered extension values. Duplicate `kind` + `id` pairs
are rejected across the complete application graph.

---

### controllers?

> `readonly` `optional` **controllers?**: readonly [`ModuleToken`](/api/framework-module/src/type-aliases/moduletoken/)\<`unknown`\>[]

Controller tokens owned by this module. The module package records these
for diagnostics; transport packages decide how to bind them.

---

### exports?

> `readonly` `optional` **exports?**: readonly [`ModuleToken`](/api/framework-module/src/type-aliases/moduletoken/)\<`unknown`\>[]

Provider tokens that become visible to direct importers.

---

### imports?

> `readonly` `optional` **imports?**: readonly [`CrocoModuleDefinition`](/api/framework-module/src/interfaces/crocomoduledefinition/)[]

Imported modules are initialized first. Only tokens listed in an imported
module's `exports` are visible to this module context.

---

### name

> `readonly` **name**: `string`

Stable module identifier used for dependency ordering, diagnostics, and
lifecycle failure messages.

---

### providers?

> `readonly` `optional` **providers?**: readonly [`ModuleProvider`](/api/framework-module/src/type-aliases/moduleprovider/)[]

Providers owned by this module. Token-only class providers are registered
by class; string and Token providers document ownership and can be bound
with `ModuleContext.set` or a provider definition.

---

### setup?

> `readonly` `optional` **setup?**: [`ModuleLifecycleHook`](/api/framework-module/src/type-aliases/modulelifecyclehook/)

---

### shutdown?

> `readonly` `optional` **shutdown?**: [`ModuleLifecycleHook`](/api/framework-module/src/type-aliases/modulelifecyclehook/)

---

### start?

> `readonly` `optional` **start?**: [`ModuleLifecycleHook`](/api/framework-module/src/type-aliases/modulelifecyclehook/)
