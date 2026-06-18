---
editUrl: false
next: false
prev: false
title: "Problem"
---

RFC 7807 Problem Details를 표현하는 기본 추상 에러 클래스입니다.

## Extends

- `Error`

## Extended by

- [`AuditableDecoratorProblem`](/api/audit-core/src/classes/auditabledecoratorproblem/)
- [`ApiKeyCreationFailedProblem`](/api/auth-core/src/classes/apikeycreationfailedproblem/)
- [`ApiKeyExpiredProblem`](/api/auth-core/src/classes/apikeyexpiredproblem/)
- [`ApiKeyRevokedProblem`](/api/auth-core/src/classes/apikeyrevokedproblem/)
- [`ForbiddenProblem`](/api/auth-core/src/classes/forbiddenproblem/)
- [`InvalidPermissionActionProblem`](/api/auth-core/src/classes/invalidpermissionactionproblem/)
- [`InvalidPermissionFormatProblem`](/api/auth-core/src/classes/invalidpermissionformatproblem/)
- [`UnauthorizedProblem`](/api/auth-core/src/classes/unauthorizedproblem/)
- [`BillingAccountNotFoundProblem`](/api/billing-core/src/classes/billingaccountnotfoundproblem/)
- [`BillingCheckoutCreationProblem`](/api/billing-core/src/classes/billingcheckoutcreationproblem/)
- [`InvalidMoneyAmountProblem`](/api/billing-core/src/classes/invalidmoneyamountproblem/)
- [`InvalidMoneyCurrencyProblem`](/api/billing-core/src/classes/invalidmoneycurrencyproblem/)
- [`MoneyCurrencyMismatchProblem`](/api/billing-core/src/classes/moneycurrencymismatchproblem/)
- [`MoneyDivisionByZeroProblem`](/api/billing-core/src/classes/moneydivisionbyzeroproblem/)
- [`SubscriptionNotFoundProblem`](/api/billing-core/src/classes/subscriptionnotfoundproblem/)
- [`WebhookAlreadyProcessedProblem`](/api/billing-core/src/classes/webhookalreadyprocessedproblem/)
- [`BatchResultLengthMismatchProblem`](/api/dataloader-core/src/classes/batchresultlengthmismatchproblem/)
- [`DuplicateEventFieldProblem`](/api/events-core/src/classes/duplicateeventfieldproblem/)
- [`DuplicateEventNameProblem`](/api/events-core/src/classes/duplicateeventnameproblem/)
- [`EventAfterCommitRequiresActiveTransactionProblem`](/api/events-core/src/classes/eventaftercommitrequiresactivetransactionproblem/)
- [`EventBusNotSetProblem`](/api/events-core/src/classes/eventbusnotsetproblem/)
- [`EventDefinitionProblem`](/api/events-core/src/classes/eventdefinitionproblem/)
- [`EventDeserializationError`](/api/events-core/src/classes/eventdeserializationerror/)
- [`EventTransactionContextUnavailableProblem`](/api/events-core/src/classes/eventtransactioncontextunavailableproblem/)
- [`UnknownEventTypeProblem`](/api/events-core/src/classes/unknowneventtypeproblem/)
- [`EventPublishFailedError`](/api/events-inmemory/src/classes/eventpublishfailederror/)
- [`BackpressureExceededProblem`](/api/events-inmemory/src/classes/backpressureexceededproblem/)
- [`BackpressureTimeoutProblem`](/api/events-inmemory/src/classes/backpressuretimeoutproblem/)
- [`CircularDependencyProblem`](/api/framework-context/src/classes/circulardependencyproblem/)
- [`MiddlewareProblem`](/api/framework-context/src/classes/middlewareproblem/)
- [`ShutdownConfigurationConflictProblem`](/api/framework-context/src/classes/shutdownconfigurationconflictproblem/)
- [`ShutdownTimeoutProblem`](/api/framework-context/src/classes/shutdowntimeoutproblem/)
- [`BatchSizeExceededProblem`](/api/invitation-core/src/classes/batchsizeexceededproblem/)
- [`InvalidAutoJoinRoleProblem`](/api/invitation-core/src/classes/invalidautojoinroleproblem/)
- [`PublicEmailDomainNotAllowedProblem`](/api/invitation-core/src/classes/publicemaildomainnotallowedproblem/)
- [`InvitationAlreadyAcceptedProblem`](/api/invitation-core/src/classes/invitationalreadyacceptedproblem/)
- [`InvitationEmailMismatchProblem`](/api/invitation-core/src/classes/invitationemailmismatchproblem/)
- [`InvitationExpiredProblem`](/api/invitation-core/src/classes/invitationexpiredproblem/)
- [`InvitationInvalidStatusProblem`](/api/invitation-core/src/classes/invitationinvalidstatusproblem/)
- [`InvitationNotFoundProblem`](/api/invitation-core/src/classes/invitationnotfoundproblem/)
- [`DuplicateInvitationProblem`](/api/invitation-core/src/classes/duplicateinvitationproblem/)
- [`InvitationRateLimitExceededProblem`](/api/invitation-core/src/classes/invitationratelimitexceededproblem/)
- [`InvalidLlmPromptProblem`](/api/llm-core/src/classes/invalidllmpromptproblem/)
- [`InvalidLlmResponseProblem`](/api/llm-core/src/classes/invalidllmresponseproblem/)
- [`LlmProblem`](/api/llm-core/src/classes/llmproblem/)
- [`LlmProviderNotFoundProblem`](/api/llm-core/src/classes/llmprovidernotfoundproblem/)
- [`LlmRateLimitProblem`](/api/llm-core/src/classes/llmratelimitproblem/)
- [`LlmServiceNotInitializedProblem`](/api/llm-core/src/classes/llmservicenotinitializedproblem/)
- [`LlmTokenLimitExceededProblem`](/api/llm-core/src/classes/llmtokenlimitexceededproblem/)
- [`EmbeddingError`](/api/llm-core/src/classes/embeddingerror/)
- [`GenerationError`](/api/llm-core/src/classes/generationerror/)
- [`LlmServiceProblem`](/api/llm-core/src/classes/llmserviceproblem/)
- [`LlmStructuredOutputProblem`](/api/llm-core/src/classes/llmstructuredoutputproblem/)
- [`LlmToolExecutionProblem`](/api/llm-core/src/classes/llmtoolexecutionproblem/)
- [`ModelNotFoundError`](/api/llm-core/src/classes/modelnotfounderror/)
- [`LlmCostLimitExceededProblem`](/api/llm-metering/src/classes/llmcostlimitexceededproblem/)
- [`LlmMeteringRecordFailedProblem`](/api/llm-metering/src/classes/llmmeteringrecordfailedproblem/)
- [`LlmQuotaExceededProblem`](/api/llm-metering/src/classes/llmquotaexceededproblem/)
- [`PricingNotFoundProblem`](/api/llm-metering/src/classes/pricingnotfoundproblem/)
- [`PricingRegistryConflictProblem`](/api/llm-metering/src/classes/pricingregistryconflictproblem/)
- [`MembershipConstraintProblem`](/api/membership-core/src/classes/membershipconstraintproblem/)
- [`AlreadyMemberProblem`](/api/membership-core/src/classes/alreadymemberproblem/)
- [`InvalidRoleProblem`](/api/membership-core/src/classes/invalidroleproblem/)
- [`LastOwnerProblem`](/api/membership-core/src/classes/lastownerproblem/)
- [`MembershipNotFoundProblem`](/api/membership-core/src/classes/membershipnotfoundproblem/)
- [`OwnershipTransferRequiredProblem`](/api/membership-core/src/classes/ownershiptransferrequiredproblem/)
- [`RoleHierarchyViolationProblem`](/api/membership-core/src/classes/rolehierarchyviolationproblem/)
- [`SeatLimitExceededProblem`](/api/membership-core/src/classes/seatlimitexceededproblem/)
- [`AtomicQuotaNotSupportedProblem`](/api/metering-core/src/classes/atomicquotanotsupportedproblem/)
- [`DuplicateRecordProblem`](/api/metering-core/src/classes/duplicaterecordproblem/)
- [`InvalidMeterProblem`](/api/metering-core/src/classes/invalidmeterproblem/)
- [`QuotaExceededProblem`](/api/metering-core/src/classes/quotaexceededproblem/)
- [`RedisProblem`](/api/metering-core/src/classes/redisproblem/)
- [`CarryingCapacitySimulationProblem`](/api/metrics-core/src/classes/carryingcapacitysimulationproblem/)
- [`CarryingCapacityTenantRequiredProblem`](/api/metrics-core/src/classes/carryingcapacitytenantrequiredproblem/)
- [`GrossMarginRequiredProblem`](/api/metrics-core/src/classes/grossmarginrequiredproblem/)
- [`MixedCurrencyMRRProblem`](/api/metrics-core/src/classes/mixedcurrencymrrproblem/)
- [`RetentionMetricsUnavailableProblem`](/api/metrics-core/src/classes/retentionmetricsunavailableproblem/)
- [`SnapshotTenantRequiredProblem`](/api/metrics-core/src/classes/snapshottenantrequiredproblem/)
- [`RequestValidationProblem`](/api/protocols-rest/src/classes/requestvalidationproblem/)
- [`ResponseValidationProblem`](/api/protocols-rest/src/classes/responsevalidationproblem/)
- [`ValidationProblem`](/api/protocols-rest/src/classes/validationproblem/)
- [`RateLimitKeyBuilderProblem`](/api/ratelimit-core/src/classes/ratelimitkeybuilderproblem/)
- [`RateLimitWindowProblem`](/api/ratelimit-core/src/classes/ratelimitwindowproblem/)
- [`RateLimitExceededProblem`](/api/ratelimit-core/src/classes/ratelimitexceededproblem/)
- [`BatchLoaderFactoryNotRegisteredProblem`](/api/repository-core/src/classes/batchloaderfactorynotregisteredproblem/)
- [`BatchLoaderFactoryResolutionProblem`](/api/repository-core/src/classes/batchloaderfactoryresolutionproblem/)
- [`CircuitBreakerOpenProblem`](/api/retry-core/src/classes/circuitbreakeropenproblem/)
- [`DuplicateRecoverHandlerProblem`](/api/retry-core/src/classes/duplicaterecoverhandlerproblem/)
- [`RetryAbortedProblem`](/api/retry-core/src/classes/retryabortedproblem/)
- [`RetryExhaustedProblem`](/api/retry-core/src/classes/retryexhaustedproblem/)
- [`CircuitBreakerUnexpectedStateProblem`](/api/retry-core/src/classes/circuitbreakerunexpectedstateproblem/)
- [`IndexNotFoundProblem`](/api/search-core/src/classes/indexnotfoundproblem/)
- [`MissingTenantProblem`](/api/search-core/src/classes/missingtenantproblem/)
- [`SearchCapabilityUnavailableProblem`](/api/search-core/src/classes/searchcapabilityunavailableproblem/)
- [`StrategyUnavailableProblem`](/api/search-core/src/classes/strategyunavailableproblem/)
- [`TransformNotFoundProblem`](/api/search-core/src/classes/transformnotfoundproblem/)
- [`OtlpEndpointRequiredProblem`](/api/telemetry-sdk-node/src/classes/otlpendpointrequiredproblem/)
- [`SamplerProblem`](/api/telemetry-sdk-node/src/classes/samplerproblem/)
- [`DuplicateTxManagerRegistrationProblem`](/api/tx-core/src/classes/duplicatetxmanagerregistrationproblem/)
- [`TxManagerNotRegisteredError`](/api/tx-core/src/classes/txmanagernotregisterederror/)
- [`TxPropagationError`](/api/tx-core/src/classes/txpropagationerror/)
- [`AfterCommitHooksProblem`](/api/tx-core/src/classes/aftercommithooksproblem/)
- [`TransactionContextProblem`](/api/tx-core/src/classes/transactioncontextproblem/)
- [`TransactionDecoratorProblem`](/api/tx-core/src/classes/transactiondecoratorproblem/)
- [`TransactionTimeoutProblem`](/api/tx-core/src/classes/transactiontimeoutproblem/)
- [`RlsExecuteUnsupportedProblem`](/api/tx-drizzle/src/classes/rlsexecuteunsupportedproblem/)
- [`SavepointUnsupportedProblem`](/api/tx-drizzle/src/classes/savepointunsupportedproblem/)
- [`TenantContextRequiredProblem`](/api/tx-drizzle/src/classes/tenantcontextrequiredproblem/)

## Properties

### category

> `readonly` **category**: [`ProblemCategory`](/api/problems-core/src/enumerations/problemcategory/)

***

### cause?

> `readonly` `optional` **cause**: `Error`

#### Overrides

`Error.cause`

***

### code

> `readonly` **code**: `string`

***

### detail?

> `readonly` `optional` **detail**: `string`

***

### extensions?

> `readonly` `optional` **extensions**: [`ProblemExtensions`](/api/problems-core/src/type-aliases/problemextensions/)

***

### instance?

> `readonly` `optional` **instance**: `string`

***

### message

> **message**: `string`

#### Inherited from

`Error.message`

***

### name

> **name**: `string`

#### Inherited from

`Error.name`

***

### stack?

> `optional` **stack**: `string`

#### Inherited from

`Error.stack`

***

### type

> `readonly` **type**: `string`

***

### stackTraceLimit

> `static` **stackTraceLimit**: `number`

The `Error.stackTraceLimit` property specifies the number of stack frames
collected by a stack trace (whether generated by `new Error().stack` or
`Error.captureStackTrace(obj)`).

The default value is `10` but may be set to any valid JavaScript number. Changes
will affect any stack trace captured _after_ the value has been changed.

If set to a non-number value, or set to a negative number, stack traces will
not capture any frames.

#### Inherited from

`Error.stackTraceLimit`

## Accessors

### status

#### Get Signature

> **get** **status**(): `number`

##### Returns

`number`

***

### title

#### Get Signature

> **get** **title**(): `string`

##### Returns

`string`

## Methods

### toJSON()

> **toJSON**(): [`ProblemDetails`](/api/problems-core/src/type-aliases/problemdetails/)

#### Returns

[`ProblemDetails`](/api/problems-core/src/type-aliases/problemdetails/)

***

### captureStackTrace()

> `static` **captureStackTrace**(`targetObject`, `constructorOpt?`): `void`

Creates a `.stack` property on `targetObject`, which when accessed returns
a string representing the location in the code at which
`Error.captureStackTrace()` was called.

```js
const myObject = {};
Error.captureStackTrace(myObject);
myObject.stack;  // Similar to `new Error().stack`
```

The first line of the trace will be prefixed with
`${myObject.name}: ${myObject.message}`.

The optional `constructorOpt` argument accepts a function. If given, all frames
above `constructorOpt`, including `constructorOpt`, will be omitted from the
generated stack trace.

The `constructorOpt` argument is useful for hiding implementation
details of error generation from the user. For instance:

```js
function a() {
  b();
}

function b() {
  c();
}

function c() {
  // Create an error without stack trace to avoid calculating the stack trace twice.
  const { stackTraceLimit } = Error;
  Error.stackTraceLimit = 0;
  const error = new Error();
  Error.stackTraceLimit = stackTraceLimit;

  // Capture the stack trace above function b
  Error.captureStackTrace(error, b); // Neither function c, nor b is included in the stack trace
  throw error;
}

a();
```

#### Parameters

##### targetObject

`object`

##### constructorOpt?

`Function`

#### Returns

`void`

#### Inherited from

`Error.captureStackTrace`

***

### prepareStackTrace()

> `static` **prepareStackTrace**(`err`, `stackTraces`): `any`

#### Parameters

##### err

`Error`

##### stackTraces

`CallSite`[]

#### Returns

`any`

#### See

https://v8.dev/docs/stack-trace-api#customizing-stack-traces

#### Inherited from

`Error.prepareStackTrace`
