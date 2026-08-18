---
editUrl: false
next: false
prev: false
title: "ExecutableAssuranceGraphInput"
---

> **ExecutableAssuranceGraphInput** = `object`

## Properties

### contractGraph?

> `readonly` `optional` **contractGraph?**: [`ContractGraphSnapshot`](/api/protocols-core/src/type-aliases/contractgraphsnapshot/)

***

### criticalJourneys?

> `readonly` `optional` **criticalJourneys?**: readonly [`AssuranceCriticalJourney`](/api/testing/src/type-aliases/assurancecriticaljourney/)[]

***

### frameworkManifest?

> `readonly` `optional` **frameworkManifest?**: [`FrameworkManifest`](/api/framework-routes/src/type-aliases/frameworkmanifest/)

***

### problemRegistry?

> `readonly` `optional` **problemRegistry?**: [`ProblemRegistrySnapshot`](/api/problems-core/src/type-aliases/problemregistrysnapshot/) \| [`ProblemCodeRegistry`](/api/problems-core/src/type-aliases/problemcoderegistry/)

***

### projectMap?

> `readonly` `optional` **projectMap?**: [`AssuranceProjectMapArtifact`](/api/testing/src/type-aliases/assuranceprojectmapartifact/)

***

### providerConformance?

> `readonly` `optional` **providerConformance?**: [`ProviderConformanceMatrixManifest`](/api/testing/src/type-aliases/providerconformancematrixmanifest/)

***

### providerProfile?

> `readonly` `optional` **providerProfile?**: [`AssuranceProviderProfileArtifact`](/api/testing/src/type-aliases/assuranceproviderprofileartifact/)

***

### publicApi?

> `readonly` `optional` **publicApi?**: [`AssurancePublicApiSnapshot`](/api/testing/src/type-aliases/assurancepublicapisnapshot/)

***

### rpcContracts?

> `readonly` `optional` **rpcContracts?**: readonly [`AssuranceRpcContract`](/api/testing/src/type-aliases/assurancerpccontract/)[]

***

### runtimeCapability?

> `readonly` `optional` **runtimeCapability?**: [`RuntimeCapabilityManifest`](/api/framework-context/src/type-aliases/runtimecapabilitymanifest/)

***

### tasks?

> `readonly` `optional` **tasks?**: readonly [`AssuranceTaskArtifact`](/api/testing/src/type-aliases/assurancetaskartifact/)[]
