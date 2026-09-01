---
editUrl: false
next: false
prev: false
title: "ApplicationRuntimeGraphManifest"
---

> **ApplicationRuntimeGraphManifest** = `object`

## Properties

### applicationName

> `readonly` **applicationName**: `string`

---

### contributions

> `readonly` **contributions**: readonly `object`[]

---

### dependencyGraph

> `readonly` **dependencyGraph**: [`DependencyGraphManifest`](/api/framework-context/src/type-aliases/dependencygraphmanifest/)

---

### moduleGraph

> `readonly` **moduleGraph**: [`ModuleGraphManifest`](/api/framework-module/src/type-aliases/modulegraphmanifest/)

---

### plugins

> `readonly` **plugins**: readonly [`CrocoPluginMetadata`](/api/framework-module/src/type-aliases/crocopluginmetadata/)[]

---

### providerReplacements

> `readonly` **providerReplacements**: readonly `object`[]

---

### status

> `readonly` **status**: `"ready"` \| `"failed"`

---

### version

> `readonly` **version**: `"croco.application-runtime.graph.v1"`
