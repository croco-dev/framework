---
editUrl: false
next: false
prev: false
title: "CircuitBreakerRetryTemplate"
---

Defined in: [packages/retry-core/src/libs/CircuitBreakerRetryTemplate.ts:24](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/retry-core/src/libs/CircuitBreakerRetryTemplate.ts#L24)

Circuit Breaker와 Retry를 결합한 템플릿.

Circuit Breaker로 회로가 닫혀 있을 때만 Retry를 수행합니다.

## Example

```typescript
const template = new CircuitBreakerRetryTemplate(
  new CircuitBreaker({ circuitId: 'api-service' }),
  new RetryTemplate({ maxAttempts: 3 })
);

const result = await template.execute(
  async (ctx) => await riskyOperation(),
  async (ctx) => fallbackValue
);
```

## Constructors

### Constructor

> **new CircuitBreakerRetryTemplate**(`circuitBreaker`, `retryTemplate`): `CircuitBreakerRetryTemplate`

Defined in: [packages/retry-core/src/libs/CircuitBreakerRetryTemplate.ts:25](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/retry-core/src/libs/CircuitBreakerRetryTemplate.ts#L25)

#### Parameters

##### circuitBreaker

[`CircuitBreaker`](/api/retry-core/src/classes/circuitbreaker/)

##### retryTemplate

[`RetryTemplate`](/api/retry-core/src/classes/retrytemplate/)

#### Returns

`CircuitBreakerRetryTemplate`

## Methods

### execute()

> **execute**\<`T`\>(`callback`, `recovery?`): `Promise`\<`T`\>

Defined in: [packages/retry-core/src/libs/CircuitBreakerRetryTemplate.ts:37](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/retry-core/src/libs/CircuitBreakerRetryTemplate.ts#L37)

Circuit Breaker로 보호하며 재시도 로직을 적용하여 작업을 실행합니다.

#### Type Parameters

##### T

`T`

#### Parameters

##### callback

[`RetryCallback`](/api/retry-core/src/type-aliases/retrycallback/)\<`T`\>

실행할 작업

##### recovery?

[`RecoveryCallback`](/api/retry-core/src/type-aliases/recoverycallback/)\<`T`\>

선택적 복구 콜백

#### Returns

`Promise`\<`T`\>

작업 결과

***

### getCircuitBreaker()

> **getCircuitBreaker**(): [`CircuitBreaker`](/api/retry-core/src/classes/circuitbreaker/)

Defined in: [packages/retry-core/src/libs/CircuitBreakerRetryTemplate.ts:44](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/retry-core/src/libs/CircuitBreakerRetryTemplate.ts#L44)

Circuit Breaker 인스턴스를 반환합니다.

#### Returns

[`CircuitBreaker`](/api/retry-core/src/classes/circuitbreaker/)

***

### getRetryTemplate()

> **getRetryTemplate**(): [`RetryTemplate`](/api/retry-core/src/classes/retrytemplate/)

Defined in: [packages/retry-core/src/libs/CircuitBreakerRetryTemplate.ts:51](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/retry-core/src/libs/CircuitBreakerRetryTemplate.ts#L51)

RetryTemplate 인스턴스를 반환합니다.

#### Returns

[`RetryTemplate`](/api/retry-core/src/classes/retrytemplate/)

***

### withOptions()

> `static` **withOptions**(`circuitBreakerOptions`, `retryTemplateOptions?`): `CircuitBreakerRetryTemplate`

Defined in: [packages/retry-core/src/libs/CircuitBreakerRetryTemplate.ts:62](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/retry-core/src/libs/CircuitBreakerRetryTemplate.ts#L62)

Circuit Breaker와 Retry 옵션으로 새 인스턴스를 생성합니다.

#### Parameters

##### circuitBreakerOptions

[`CircuitBreakerOptions`](/api/retry-core/src/interfaces/circuitbreakeroptions/)

Circuit Breaker 옵션

##### retryTemplateOptions?

[`RetryTemplateOptions`](/api/retry-core/src/interfaces/retrytemplateoptions/) = `{}`

Retry 옵션

#### Returns

`CircuitBreakerRetryTemplate`

새 인스턴스
