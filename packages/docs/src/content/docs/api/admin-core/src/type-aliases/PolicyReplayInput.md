---
editUrl: false
next: false
prev: false
title: "PolicyReplayInput"
---

> **PolicyReplayInput** = `object`

## Properties

### attributionWindowMs

> `readonly` **attributionWindowMs**: `number`

---

### currency

> `readonly` **currency**: `string`

---

### definition

> `readonly` **definition**: `object`

#### changes

> `readonly` **changes**: readonly (`"filter"` \| `"content"` \| `"frequency"` \| `"timing"`)[]

#### existingPredicate

> `readonly` **existingPredicate**: [`ReplayPredicate`](/api/metrics-core/src/type-aliases/replaypredicate/)

#### newPredicate

> `readonly` **newPredicate**: [`ReplayPredicate`](/api/metrics-core/src/type-aliases/replaypredicate/)

#### revision

> `readonly` **revision**: `string`

#### scenarios

> `readonly` **scenarios**: readonly [`ReplayScenario`](/api/metrics-core/src/type-aliases/replayscenario/)[]

#### unknownPolicy

> `readonly` **unknownPolicy**: `"preserve"` \| `"exclude"`

---

### observationWindow

> `readonly` **observationWindow**: `object`

#### completed

> `readonly` **completed**: `boolean`

#### end

> `readonly` **end**: `string`

#### start

> `readonly` **start**: `string`

---

### rows

> `readonly` **rows**: readonly [`ReplayRow`](/api/metrics-core/src/type-aliases/replayrow/)[]

---

### scope

> `readonly` **scope**: [`ReplayScope`](/api/admin-core/src/type-aliases/replayscope/)

---

### snapshotRef

> `readonly` **snapshotRef**: `string`

---

### unit

> `readonly` **unit**: `string`
