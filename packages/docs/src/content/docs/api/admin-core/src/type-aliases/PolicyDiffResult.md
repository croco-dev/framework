---
editUrl: false
next: false
prev: false
title: "PolicyDiffResult"
---

> **PolicyDiffResult** = `object`

## Properties

### assumptions

> `readonly` **assumptions**: readonly `string`[]

---

### baselineN

> `readonly` **baselineN**: `number`

---

### effectiveExcludedN

> `readonly` **effectiveExcludedN**: `number`

---

### effectiveKeptN

> `readonly` **effectiveKeptN**: `number`

---

### excludedN

> `readonly` **excludedN**: `number`

---

### keptN

> `readonly` **keptN**: `number`

---

### limitations

> `readonly` **limitations**: readonly `string`[]

---

### observedCostSaved

> `readonly` **observedCostSaved**: `object`

#### amount

> `readonly` **amount**: `number` \| `null`

#### currency

> `readonly` **currency**: `string`

#### observedDispatchN

> `readonly` **observedDispatchN**: `number`

#### status

> `readonly` **status**: `"available"` \| `"partial"` \| `"unavailable"`

#### totalDispatchN

> `readonly` **totalDispatchN**: `number`

#### unit

> `readonly` **unit**: `string`

---

### observedVisits

> `readonly` **observedVisits**: `object`

#### postClickN

> `readonly` **postClickN**: `number`

#### postSendNonClickN

> `readonly` **postSendNonClickN**: `number`

#### postSendUnknownClickN

> `readonly` **postSendUnknownClickN**: `number`

#### preSendN

> `readonly` **preSendN**: `number`

---

### scenarioValues

> `readonly` **scenarioValues**: readonly `object`[]

---

### sourceCoverage

> `readonly` **sourceCoverage**: `object`

#### dispatchN

> `readonly` **dispatchN**: `number`

#### historicalTraitsN

> `readonly` **historicalTraitsN**: `number`

#### observedCostN

> `readonly` **observedCostN**: `number`

#### outcomesN

> `readonly` **outcomesN**: `number`

#### subjectN

> `readonly` **subjectN**: `number`

#### touchpointsN

> `readonly` **touchpointsN**: `number`

---

### unknownN

> `readonly` **unknownN**: `number`
