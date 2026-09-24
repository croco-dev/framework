---
editUrl: false
next: false
prev: false
title: "Container"
---

Croco 컴포넌트의 등록, 조회, 지연 생성, 요청 스코프 해석을 담당하는 DI 컨테이너입니다.

## Constructors

### Constructor

> **new Container**(): `Container`

#### Returns

`Container`

## Methods

### createDependencyGraphManifest()

> `static` **createDependencyGraphManifest**(`options?`): [`DependencyGraphManifest`](/api/framework-context/src/type-aliases/dependencygraphmanifest/)

#### Parameters

##### options?

###### knownProviders?

`ReadonlySet`\<[`TokenIdentifier`](/api/framework-context/src/type-aliases/tokenidentifier/)\<`unknown`\>\>

###### providerConstructors?

`ReadonlyMap`\<[`TokenIdentifier`](/api/framework-context/src/type-aliases/tokenidentifier/)\<`unknown`\>, [`Constructor`](/api/framework-context/src/type-aliases/constructor/)\<`unknown`\>\>

###### rejectUnknownProviders?

`boolean`

###### roots?

readonly [`TokenIdentifier`](/api/framework-context/src/type-aliases/tokenidentifier/)\<`unknown`\>[]

#### Returns

[`DependencyGraphManifest`](/api/framework-context/src/type-aliases/dependencygraphmanifest/)

---

### createScope()

> `static` **createScope**(): [`ContainerScope`](/api/framework-context/src/classes/containerscope/)

#### Returns

[`ContainerScope`](/api/framework-context/src/classes/containerscope/)

---

### get()

> `static` **get**\<`T`\>(`token`): `T`

#### Type Parameters

##### T

`T`

#### Parameters

##### token

[`TokenIdentifier`](/api/framework-context/src/type-aliases/tokenidentifier/)\<`T`\>

#### Returns

`T`

---

### getActiveScopeId()

> `static` **getActiveScopeId**(): `string` \| `undefined`

#### Returns

`string` \| `undefined`

---

### getComponentMetadata()

> `static` **getComponentMetadata**(`target`): [`ComponentMetadata`](/api/framework-context/src/interfaces/componentmetadata/) \| `undefined`

#### Parameters

##### target

[`Constructor`](/api/framework-context/src/type-aliases/constructor/)

#### Returns

[`ComponentMetadata`](/api/framework-context/src/interfaces/componentmetadata/) \| `undefined`

---

### getDiagnosticsSnapshot()

> `static` **getDiagnosticsSnapshot**(): `object`

#### Returns

`object`

##### isInitialized

> **isInitialized**: `boolean`

##### lastResolutionTrace?

> `optional` **lastResolutionTrace?**: [`DependencyResolutionTrace`](/api/framework-context/src/type-aliases/dependencyresolutiontrace/)

##### registeredServiceCount

> **registeredServiceCount**: `number`

##### scopes

> **scopes**: `string`[]

---

### getGeneratedProviderTokens()

> `static` **getGeneratedProviderTokens**(`kind`): readonly [`Constructor`](/api/framework-context/src/type-aliases/constructor/)[]

#### Parameters

##### kind

[`GeneratedProviderKind`](/api/framework-context/src/type-aliases/generatedproviderkind/)

#### Returns

readonly [`Constructor`](/api/framework-context/src/type-aliases/constructor/)[]

---

### getLastResolutionTrace()

> `static` **getLastResolutionTrace**(): [`DependencyResolutionTrace`](/api/framework-context/src/type-aliases/dependencyresolutiontrace/) \| `undefined`

#### Returns

[`DependencyResolutionTrace`](/api/framework-context/src/type-aliases/dependencyresolutiontrace/) \| `undefined`

---

### getMany()

#### Call Signature

> `static` **getMany**\<`TTokens`\>(`tokens`): \{ -readonly \[TIndex in string \| number \| symbol\]: TokenIdentifierValue\<TTokens\[TIndex\]\> \}

##### Type Parameters

###### TTokens

`TTokens` _extends_ readonly [`TokenIdentifier`](/api/framework-context/src/type-aliases/tokenidentifier/)\<`unknown`\>[]

##### Parameters

###### tokens

`TTokens`

##### Returns

\{ -readonly \[TIndex in string \| number \| symbol\]: TokenIdentifierValue\<TTokens\[TIndex\]\> \}

#### Call Signature

> `static` **getMany**\<`T`\>(`token`): `T`[]

##### Type Parameters

###### T

`T`

##### Parameters

###### token

[`TokenIdentifier`](/api/framework-context/src/type-aliases/tokenidentifier/)\<`T`\>

##### Returns

`T`[]

---

### getOptional()

> `static` **getOptional**\<`T`\>(`token`): `T` \| `undefined`

#### Type Parameters

##### T

`T`

#### Parameters

##### token

[`TokenIdentifier`](/api/framework-context/src/type-aliases/tokenidentifier/)\<`T`\>

#### Returns

`T` \| `undefined`

---

### getResolutionTrace()

> `static` **getResolutionTrace**\<`T`\>(`token`): [`DependencyResolutionTrace`](/api/framework-context/src/type-aliases/dependencyresolutiontrace/)

#### Type Parameters

##### T

`T`

#### Parameters

##### token

[`TokenIdentifier`](/api/framework-context/src/type-aliases/tokenidentifier/)\<`T`\>

#### Returns

[`DependencyResolutionTrace`](/api/framework-context/src/type-aliases/dependencyresolutiontrace/)

---

### has()

> `static` **has**\<`T`\>(`token`): `boolean`

#### Type Parameters

##### T

`T`

#### Parameters

##### token

[`TokenIdentifier`](/api/framework-context/src/type-aliases/tokenidentifier/)\<`T`\>

#### Returns

`boolean`

---

### inspectConstructorInjections()

> `static` **inspectConstructorInjections**(`token`): readonly [`InjectionInspection`](/api/framework-context/src/type-aliases/injectioninspection/)[]

#### Parameters

##### token

[`Constructor`](/api/framework-context/src/type-aliases/constructor/)

#### Returns

readonly [`InjectionInspection`](/api/framework-context/src/type-aliases/injectioninspection/)[]

---

### inspectInjections()

> `static` **inspectInjections**(`token`): readonly [`InjectionInspection`](/api/framework-context/src/type-aliases/injectioninspection/)[]

#### Parameters

##### token

[`Constructor`](/api/framework-context/src/type-aliases/constructor/)

#### Returns

readonly [`InjectionInspection`](/api/framework-context/src/type-aliases/injectioninspection/)[]

---

### installGeneratedGraph()

> `static` **installGeneratedGraph**(`graph`): `void`

#### Parameters

##### graph

[`GeneratedDiGraph`](/api/framework-context/src/type-aliases/generateddigraph/)

#### Returns

`void`

---

### register()

> `static` **register**\<`T`\>(`token`, `scope`): `void`

#### Type Parameters

##### T

`T`

#### Parameters

##### token

[`Constructor`](/api/framework-context/src/type-aliases/constructor/)\<`T`\>

##### scope

[`Scope`](/api/framework-context/src/type-aliases/scope/)

#### Returns

`void`

---

### registerAsync()

> `static` **registerAsync**\<`T`\>(`token`, `factory`): `Promise`\<`T`\>

#### Type Parameters

##### T

`T`

#### Parameters

##### token

[`TokenIdentifier`](/api/framework-context/src/type-aliases/tokenidentifier/)\<`T`\>

##### factory

() => `Promise`\<`T`\>

#### Returns

`Promise`\<`T`\>

---

### registerLazy()

> `static` **registerLazy**\<`T`\>(`token`, `factory`): `void`

#### Type Parameters

##### T

`T`

#### Parameters

##### token

[`TokenIdentifier`](/api/framework-context/src/type-aliases/tokenidentifier/)\<`T`\>

##### factory

() => `T`

#### Returns

`void`

---

### remove()

> `static` **remove**\<`T`\>(`token`): `void`

#### Type Parameters

##### T

`T`

#### Parameters

##### token

[`TokenIdentifier`](/api/framework-context/src/type-aliases/tokenidentifier/)\<`T`\>

#### Returns

`void`

---

### removeGeneratedGraph()

> `static` **removeGeneratedGraph**(`graphId`): `void`

#### Parameters

##### graphId

`string`

#### Returns

`void`

---

### reset()

> `static` **reset**(): `void`

#### Returns

`void`

---

### set()

> `static` **set**\<`T`\>(`token`, `instance`): `T`

#### Type Parameters

##### T

`T`

#### Parameters

##### token

[`TokenIdentifier`](/api/framework-context/src/type-aliases/tokenidentifier/)\<`T`\>

##### instance

`T`

#### Returns

`T`

---

### setComponentSourceLocation()

> `static` **setComponentSourceLocation**\<`T`\>(`token`, `sourceLocation?`): `void`

#### Type Parameters

##### T

`T`

#### Parameters

##### token

[`Constructor`](/api/framework-context/src/type-aliases/constructor/)\<`T`\>

##### sourceLocation?

[`DependencySourceLocation`](/api/framework-context/src/type-aliases/dependencysourcelocation/)

#### Returns

`void`

---

### toServiceIdentifier()

> `static` **toServiceIdentifier**\<`T`\>(`token`): [`ServiceIdentifier`](/api/framework-context/src/type-aliases/serviceidentifier/)\<`T`\>

Returns the Croco runtime identifier used internally for a Croco token.
Symbol mappings remain stable until [Container.reset](/api/framework-context/src/classes/container/#reset).

#### Type Parameters

##### T

`T`

#### Parameters

##### token

[`TokenIdentifier`](/api/framework-context/src/type-aliases/tokenidentifier/)\<`T`\>

#### Returns

[`ServiceIdentifier`](/api/framework-context/src/type-aliases/serviceidentifier/)\<`T`\>

---

### validate()

> `static` **validate**(`options?`): `void`

#### Parameters

##### options?

[`ContainerValidationOptions`](/api/framework-context/src/type-aliases/containervalidationoptions/) = `{}`

#### Returns

`void`
