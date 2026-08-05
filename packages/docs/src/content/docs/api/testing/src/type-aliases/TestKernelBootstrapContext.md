---
editUrl: false
next: false
prev: false
title: "TestKernelBootstrapContext"
---

> **TestKernelBootstrapContext** = `object`

## Properties

### clock

> `readonly` **clock**: [`TestClock`](/api/testing/src/classes/testclock/)

---

### environment

> `readonly` **environment**: [`TestEnvironment`](/api/testing/src/classes/testenvironment/)

---

### fidelity

> `readonly` **fidelity**: [`TestKernelBootFidelity`](/api/testing/src/type-aliases/testkernelbootfidelity/)

---

### ids

> `readonly` **ids**: [`TestIdSource`](/api/testing/src/classes/testidsource/)

---

### network

> `readonly` **network**: [`TestNetwork`](/api/testing/src/classes/testnetwork/)

---

### onCleanup

> `readonly` **onCleanup**: (`cleanup`) => `void`

#### Parameters

##### cleanup

() => `Promise`\<`void`\> \| `void`

#### Returns

`void`

---

### random

> `readonly` **random**: [`TestRandomSource`](/api/testing/src/classes/testrandomsource/)

---

### replay

> `readonly` **replay**: [`TestReplayMetadata`](/api/testing/src/type-aliases/testreplaymetadata/)

---

### retry

> `readonly` **retry**: [`TestRetryDependencies`](/api/testing/src/type-aliases/testretrydependencies/)

---

### runtime

> `readonly` **runtime**: [`TestKernelRuntime`](/api/testing/src/type-aliases/testkernelruntime/)
