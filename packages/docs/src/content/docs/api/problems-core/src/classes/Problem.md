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

- [`ArchitecturePolicyManifestShapeProblem`](/api/architecture-policy/src/classes/architecturepolicymanifestshapeproblem/)
- [`ArchitecturePolicyManifestJsonParseProblem`](/api/architecture-policy/src/classes/architecturepolicymanifestjsonparseproblem/)
- [`ArchitecturePolicyManifestSchemaVersionProblem`](/api/architecture-policy/src/classes/architecturepolicymanifestschemaversionproblem/)
- [`ArchitecturePolicyPackageJsonParseProblem`](/api/architecture-policy/src/classes/architecturepolicypackagejsonparseproblem/)
- [`ProblemFetchUnavailableError`](/api/frontend-problems/src/classes/problemfetchunavailableerror/)
- [`BetterAuthAuthenticationProblem`](/api/auth-better-auth/src/classes/betterauthauthenticationproblem/)
- [`BetterAuthNotInitializedProblem`](/api/auth-better-auth/src/classes/betterauthnotinitializedproblem/)
- [`BetterAuthSessionNotFoundProblem`](/api/auth-better-auth/src/classes/betterauthsessionnotfoundproblem/)
- [`BetterAuthUserNotFoundProblem`](/api/auth-better-auth/src/classes/betterauthusernotfoundproblem/)
- [`BetterAuthInvalidSessionProblem`](/api/auth-better-auth/src/classes/betterauthinvalidsessionproblem/)
- [`BetterAuthSessionLookupProblem`](/api/auth-better-auth/src/classes/betterauthsessionlookupproblem/)
- [`InvalidWebhookSignatureProblem`](/api/auth-better-auth/src/classes/invalidwebhooksignatureproblem/)
- [`InvalidWebhookPayloadProblem`](/api/auth-better-auth/src/classes/invalidwebhookpayloadproblem/)
- [`QStashBatchConfigProblem`](/api/batch-qstash/src/classes/qstashbatchconfigproblem/)
- [`QStashBatchValidationProblem`](/api/batch-qstash/src/classes/qstashbatchvalidationproblem/)
- [`QStashBatchPublishProblem`](/api/batch-qstash/src/classes/qstashbatchpublishproblem/)
- [`ConfigSchemaNotFoundProblem`](/api/framework-config/src/classes/configschemanotfoundproblem/)
- [`ConfigValidationProblem`](/api/framework-config/src/classes/configvalidationproblem/)
- [`InvalidBooleanEnvProblem`](/api/framework-config/src/classes/invalidbooleanenvproblem/)
- [`SelfImpersonationProblem`](/api/impersonation-core/src/classes/selfimpersonationproblem/)
- [`NestedImpersonationProblem`](/api/impersonation-core/src/classes/nestedimpersonationproblem/)
- [`ImpersonationReasonRequiredProblem`](/api/impersonation-core/src/classes/impersonationreasonrequiredproblem/)
- [`BlockedDuringImpersonationProblem`](/api/impersonation-core/src/classes/blockedduringimpersonationproblem/)
- [`ImpersonationSessionNotFoundProblem`](/api/impersonation-core/src/classes/impersonationsessionnotfoundproblem/)
- [`NotificationProviderNotConfiguredProblem`](/api/notifications-core/src/classes/notificationprovidernotconfiguredproblem/)
- [`NotificationProviderNotRegisteredProblem`](/api/notifications-core/src/classes/notificationprovidernotregisteredproblem/)
- [`NotificationProviderAlreadyRegisteredProblem`](/api/notifications-core/src/classes/notificationprovideralreadyregisteredproblem/)
- [`NotificationDefaultProviderConflictProblem`](/api/notifications-core/src/classes/notificationdefaultproviderconflictproblem/)
- [`NotificationProviderChannelMismatchProblem`](/api/notifications-core/src/classes/notificationproviderchannelmismatchproblem/)
- [`NotificationProviderNotFoundProblem`](/api/notifications-core/src/classes/notificationprovidernotfoundproblem/)
- [`NotificationSendMaxAttemptsInvalidProblem`](/api/notifications-core/src/classes/notificationsendmaxattemptsinvalidproblem/)
- [`NotificationDeliveryFailedProblem`](/api/notifications-core/src/classes/notificationdeliveryfailedproblem/)
- [`NotificationPreferenceDeniedProblem`](/api/notifications-core/src/classes/notificationpreferencedeniedproblem/)
- [`NotificationPreferenceContextRequiredProblem`](/api/notifications-core/src/classes/notificationpreferencecontextrequiredproblem/)
- [`NotificationPreferenceChannelMismatchProblem`](/api/notifications-core/src/classes/notificationpreferencechannelmismatchproblem/)
- [`NotificationIdempotencyKeyRequiredProblem`](/api/notifications-core/src/classes/notificationidempotencykeyrequiredproblem/)
- [`NotificationOutboxIdempotencyMismatchProblem`](/api/notifications-core/src/classes/notificationoutboxidempotencymismatchproblem/)
- [`NotificationTemplateAlreadyRegisteredProblem`](/api/notifications-core/src/classes/notificationtemplatealreadyregisteredproblem/)
- [`NotificationTemplateNotFoundProblem`](/api/notifications-core/src/classes/notificationtemplatenotfoundproblem/)
- [`NotificationTemplateVariablesInvalidProblem`](/api/notifications-core/src/classes/notificationtemplatevariablesinvalidproblem/)
- [`InvalidSearchRowProblem`](/api/search-drizzle/src/classes/invalidsearchrowproblem/)
- [`BadRequestProblem`](/api/access-core/src/classes/badrequestproblem/)
- [`ForbiddenProblem`](/api/access-core/src/classes/forbiddenproblem/)
- [`AdminResourceValidationProblem`](/api/admin-core/src/classes/adminresourcevalidationproblem/)
- [`AdminGeneratedContractProblem`](/api/admin-generated/src/classes/admingeneratedcontractproblem/)
- [`PostHogAnalyticsCaptureProblem`](/api/analytics-posthog/src/classes/posthoganalyticscaptureproblem/)
- [`PostHogAnalyticsFlushProblem`](/api/analytics-posthog/src/classes/posthoganalyticsflushproblem/)
- [`PostHogAnalyticsReadinessProblem`](/api/analytics-posthog/src/classes/posthoganalyticsreadinessproblem/)
- [`AuditableDecoratorProblem`](/api/audit-core/src/classes/auditabledecoratorproblem/)
- [`ClerkExternalServiceProblem`](/api/auth-clerk/src/classes/clerkexternalserviceproblem/)
- [`ClerkMalformedClaimProblem`](/api/auth-clerk/src/classes/clerkmalformedclaimproblem/)
- [`ClerkPublicUserDataMissingProblem`](/api/auth-clerk/src/classes/clerkpublicuserdatamissingproblem/)
- [`ClerkTokenVerificationProblem`](/api/auth-clerk/src/classes/clerktokenverificationproblem/)
- [`ClerkTokenVerificationUpstreamProblem`](/api/auth-clerk/src/classes/clerktokenverificationupstreamproblem/)
- [`DuplicateTenantMappingProblem`](/api/auth-clerk/src/classes/duplicatetenantmappingproblem/)
- [`InvalidWebhookPayloadProblem`](/api/auth-clerk/src/classes/invalidwebhookpayloadproblem/)
- [`WebhookVerificationProblem`](/api/auth-clerk/src/classes/webhookverificationproblem/)
- [`ApiKeyCreationFailedProblem`](/api/auth-core/src/classes/apikeycreationfailedproblem/)
- [`ApiKeyExpiredProblem`](/api/auth-core/src/classes/apikeyexpiredproblem/)
- [`ApiKeyRevokedProblem`](/api/auth-core/src/classes/apikeyrevokedproblem/)
- [`AuthProviderUnavailableProblem`](/api/auth-core/src/classes/authproviderunavailableproblem/)
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
- [`BillingStatusMappingProblem`](/api/billing-polar/src/classes/billingstatusmappingproblem/)
- [`PolarCustomerNotFoundProblem`](/api/billing-polar/src/classes/polarcustomernotfoundproblem/)
- [`PolarMissingConfigProblem`](/api/billing-polar/src/classes/polarmissingconfigproblem/)
- [`PolarRetryableUpstreamProblem`](/api/billing-polar/src/classes/polarretryableupstreamproblem/)
- [`PolarSubscriptionNotFoundProblem`](/api/billing-polar/src/classes/polarsubscriptionnotfoundproblem/)
- [`PolarTerminalUpstreamProblem`](/api/billing-polar/src/classes/polarterminalupstreamproblem/)
- [`PolarValidationProblem`](/api/billing-polar/src/classes/polarvalidationproblem/)
- [`WebhookProcessingProblem`](/api/billing-polar/src/classes/webhookprocessingproblem/)
- [`WebhookValidationProblem`](/api/billing-polar/src/classes/webhookvalidationproblem/)
- [`CacheDecoratorConfigProblem`](/api/cache-core/src/classes/cachedecoratorconfigproblem/)
- [`CacheInvalidationAssertionProblem`](/api/cache-core/src/classes/cacheinvalidationassertionproblem/)
- [`CacheInvalidationFailedProblem`](/api/cache-core/src/classes/cacheinvalidationfailedproblem/)
- [`CacheInvalidationGraphProblem`](/api/cache-core/src/classes/cacheinvalidationgraphproblem/)
- [`UnknownCacheInvalidationEventProblem`](/api/cache-core/src/classes/unknowncacheinvalidationeventproblem/)
- [`UnsupportedCacheInvalidationCapabilityProblem`](/api/cache-core/src/classes/unsupportedcacheinvalidationcapabilityproblem/)
- [`HealthScoreNotFoundProblem`](/api/customer-health-core/src/classes/healthscorenotfoundproblem/)
- [`BatchResultLengthMismatchProblem`](/api/dataloader-core/src/classes/batchresultlengthmismatchproblem/)
- [`DuplicateDiagnosticsProviderProblem`](/api/diagnostics-core/src/classes/duplicatediagnosticsproviderproblem/)
- [`EntitlementDeniedProblem`](/api/entitlements-core/src/classes/entitlementdeniedproblem/)
- [`EntitlementInactiveSubscriptionProblem`](/api/entitlements-core/src/classes/entitlementinactivesubscriptionproblem/)
- [`EntitlementMissingPlanProblem`](/api/entitlements-core/src/classes/entitlementmissingplanproblem/)
- [`EntitlementNotFoundProblem`](/api/entitlements-core/src/classes/entitlementnotfoundproblem/)
- [`EntitlementProviderUnavailableProblem`](/api/entitlements-core/src/classes/entitlementproviderunavailableproblem/)
- [`EntitlementQuotaExceededProblem`](/api/entitlements-core/src/classes/entitlementquotaexceededproblem/)
- [`EntitlementRequirementProblem`](/api/entitlements-core/src/classes/entitlementrequirementproblem/)
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
- [`OutboxPublishExhaustedProblem`](/api/events-tx/src/classes/outboxpublishexhaustedproblem/)
- [`OutboxStorageProblem`](/api/events-tx/src/classes/outboxstorageproblem/)
- [`OutboxTransactionRequiredProblem`](/api/events-tx/src/classes/outboxtransactionrequiredproblem/)
- [`TransactionStateProblem`](/api/events-tx/src/classes/transactionstateproblem/)
- [`ExecutionProblem`](/api/execution-core/src/classes/executionproblem/)
- [`ContainerResolutionProblem`](/api/framework-context/src/classes/containerresolutionproblem/)
- [`ContainerScopeMismatchProblem`](/api/framework-context/src/classes/containerscopemismatchproblem/)
- [`CircularDependencyProblem`](/api/framework-context/src/classes/circulardependencyproblem/)
- [`MiddlewareProblem`](/api/framework-context/src/classes/middlewareproblem/)
- [`PolicyCapabilityProblem`](/api/framework-context/src/classes/policycapabilityproblem/)
- [`PolicyConflictProblem`](/api/framework-context/src/classes/policyconflictproblem/)
- [`PolicyDefinitionProblem`](/api/framework-context/src/classes/policydefinitionproblem/)
- [`PipelineGraphProblem`](/api/framework-context/src/classes/pipelinegraphproblem/)
- [`ShutdownConfigurationConflictProblem`](/api/framework-context/src/classes/shutdownconfigurationconflictproblem/)
- [`ShutdownTimeoutProblem`](/api/framework-context/src/classes/shutdowntimeoutproblem/)
- [`InvalidModuleDefinitionProblem`](/api/framework-module/src/classes/invalidmoduledefinitionproblem/)
- [`ModuleCircularDependencyProblem`](/api/framework-module/src/classes/modulecirculardependencyproblem/)
- [`ModuleLifecycleProblem`](/api/framework-module/src/classes/modulelifecycleproblem/)
- [`ModuleProviderVisibilityProblem`](/api/framework-module/src/classes/moduleprovidervisibilityproblem/)
- [`MissingCloudflareVitePluginProblem`](/api/frontend-vite/src/classes/missingcloudflarevitepluginproblem/)
- [`InvalidIdPrefixProblem`](/api/gid-core/src/classes/invalididprefixproblem/)
- [`IdPrefixProblem`](/api/gid-core/src/classes/idprefixproblem/)
- [`DataGovernanceValidationProblem`](/api/governance-core/src/classes/datagovernancevalidationproblem/)
- [`RetentionPolicyViolationProblem`](/api/governance-core/src/classes/retentionpolicyviolationproblem/)
- [`UnsupportedDataDeleteProblem`](/api/governance-core/src/classes/unsupporteddatadeleteproblem/)
- [`UnsupportedDataExportProblem`](/api/governance-core/src/classes/unsupporteddataexportproblem/)
- [`PostHogConfigProblem`](/api/integrations-posthog/src/classes/posthogconfigproblem/)
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
- [`DuplicateLifecycleRuleProblem`](/api/lifecycle-core/src/classes/duplicatelifecycleruleproblem/)
- [`LifecycleActionAdapterProblem`](/api/lifecycle-core/src/classes/lifecycleactionadapterproblem/)
- [`LifecycleRuleDefinitionProblem`](/api/lifecycle-core/src/classes/lifecycleruledefinitionproblem/)
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
- [`OpenAiAbortProblem`](/api/llm-openai/src/classes/openaiabortproblem/)
- [`OpenAiAuthenticationProblem`](/api/llm-openai/src/classes/openaiauthenticationproblem/)
- [`OpenAiInvalidResponseProblem`](/api/llm-openai/src/classes/openaiinvalidresponseproblem/)
- [`OpenAiMissingConfigProblem`](/api/llm-openai/src/classes/openaimissingconfigproblem/)
- [`OpenAiRateLimitProblem`](/api/llm-openai/src/classes/openairatelimitproblem/)
- [`OpenAiRetryableUpstreamProblem`](/api/llm-openai/src/classes/openairetryableupstreamproblem/)
- [`OpenAiTerminalUpstreamProblem`](/api/llm-openai/src/classes/openaiterminalupstreamproblem/)
- [`OpenAiValidationProblem`](/api/llm-openai/src/classes/openaivalidationproblem/)
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
- [`ServerActionInvalidPathProblem`](/api/meta-vite/src/classes/serveractioninvalidpathproblem/)
- [`ServerActionNotFoundProblem`](/api/meta-vite/src/classes/serveractionnotfoundproblem/)
- [`ServerActionValidationProblem`](/api/meta-vite/src/classes/serveractionvalidationproblem/)
- [`AtomicQuotaNotSupportedProblem`](/api/metering-core/src/classes/atomicquotanotsupportedproblem/)
- [`DuplicateRecordProblem`](/api/metering-core/src/classes/duplicaterecordproblem/)
- [`InvalidMeterProblem`](/api/metering-core/src/classes/invalidmeterproblem/)
- [`QuotaExceededProblem`](/api/metering-core/src/classes/quotaexceededproblem/)
- [`RedisProblem`](/api/metering-core/src/classes/redisproblem/)
- [`MissingUpstashMeteringConfigProblem`](/api/metering-upstash/src/classes/missingupstashmeteringconfigproblem/)
- [`UpstashMeteringUpstreamProblem`](/api/metering-upstash/src/classes/upstashmeteringupstreamproblem/)
- [`BillingMetricDroppedProblem`](/api/metrics-billing/src/classes/billingmetricdroppedproblem/)
- [`BillingMetricRecordingProblem`](/api/metrics-billing/src/classes/billingmetricrecordingproblem/)
- [`CarryingCapacitySimulationProblem`](/api/metrics-core/src/classes/carryingcapacitysimulationproblem/)
- [`CarryingCapacityTenantRequiredProblem`](/api/metrics-core/src/classes/carryingcapacitytenantrequiredproblem/)
- [`GrossMarginRequiredProblem`](/api/metrics-core/src/classes/grossmarginrequiredproblem/)
- [`MixedCurrencyMRRProblem`](/api/metrics-core/src/classes/mixedcurrencymrrproblem/)
- [`RetentionMetricsUnavailableProblem`](/api/metrics-core/src/classes/retentionmetricsunavailableproblem/)
- [`SnapshotTenantRequiredProblem`](/api/metrics-core/src/classes/snapshottenantrequiredproblem/)
- [`DatabaseUrlRequiredProblem`](/api/migration-runner/src/classes/databaseurlrequiredproblem/)
- [`InvalidMigrationCountProblem`](/api/migration-runner/src/classes/invalidmigrationcountproblem/)
- [`MigrationTransactionRequiredProblem`](/api/migration-runner/src/classes/migrationtransactionrequiredproblem/)
- [`MissingDownFunctionProblem`](/api/migration-runner/src/classes/missingdownfunctionproblem/)
- [`MissingUpFunctionProblem`](/api/migration-runner/src/classes/missingupfunctionproblem/)
- [`UnsupportedDialectProblem`](/api/migration-runner/src/classes/unsupporteddialectproblem/)
- [`UnsupportedMigrationQueryResultProblem`](/api/migration-runner/src/classes/unsupportedmigrationqueryresultproblem/)
- [`ResendIdempotencyConflictProblem`](/api/notifications-resend/src/classes/resendidempotencyconflictproblem/)
- [`ResendMissingConfigProblem`](/api/notifications-resend/src/classes/resendmissingconfigproblem/)
- [`ResendNotificationProblem`](/api/notifications-resend/src/classes/resendnotificationproblem/)
- [`ResendRetryableUpstreamProblem`](/api/notifications-resend/src/classes/resendretryableupstreamproblem/)
- [`ResendTerminalUpstreamProblem`](/api/notifications-resend/src/classes/resendterminalupstreamproblem/)
- [`ResendValidationProblem`](/api/notifications-resend/src/classes/resendvalidationproblem/)
- [`OnboardingContextRequiredProblem`](/api/onboarding-core/src/classes/onboardingcontextrequiredproblem/)
- [`OnboardingDefinitionNotFoundProblem`](/api/onboarding-core/src/classes/onboardingdefinitionnotfoundproblem/)
- [`OnboardingStepNotFoundProblem`](/api/onboarding-core/src/classes/onboardingstepnotfoundproblem/)
- [`OutboxDispatchProblem`](/api/outbox-core/src/classes/outboxdispatchproblem/)
- [`OutboxFailureMetadataProblem`](/api/outbox-core/src/classes/outboxfailuremetadataproblem/)
- [`OutboxRecordIdConflictProblem`](/api/outbox-core/src/classes/outboxrecordidconflictproblem/)
- [`OutboxUnitOfWorkContextProblem`](/api/outbox-core/src/classes/outboxunitofworkcontextproblem/)
- [`ConflictingPaginationProblem`](/api/pagination-core/src/classes/conflictingpaginationproblem/)
- [`InvalidCursorProblem`](/api/pagination-core/src/classes/invalidcursorproblem/)
- [`ProblemRegistryValidationProblem`](/api/problems-core/src/classes/problemregistryvalidationproblem/)
- [`ContractGraphDiagnosticError`](/api/protocols-core/src/classes/contractgraphdiagnosticerror/)
- [`GraphQLAuthenticationProblem`](/api/protocols-graphql/src/classes/graphqlauthenticationproblem/)
- [`GraphQLAuthorizationProblem`](/api/protocols-graphql/src/classes/graphqlauthorizationproblem/)
- [`GraphQLInternalError`](/api/protocols-graphql/src/classes/graphqlinternalerror/)
- [`GraphQLNotFoundProblem`](/api/protocols-graphql/src/classes/graphqlnotfoundproblem/)
- [`GraphQLValidationProblem`](/api/protocols-graphql/src/classes/graphqlvalidationproblem/)
- [`GuardDeniedProblem`](/api/protocols-graphql/src/classes/guarddeniedproblem/)
- [`RequestValidationProblem`](/api/protocols-rest/src/classes/requestvalidationproblem/)
- [`ResponseValidationProblem`](/api/protocols-rest/src/classes/responsevalidationproblem/)
- [`ValidationProblem`](/api/protocols-rest/src/classes/validationproblem/)
- [`TrpcRouteHandlerError`](/api/protocols-trpc/src/classes/trpcroutehandlererror/)
- [`RateLimitKeyBuilderProblem`](/api/ratelimit-core/src/classes/ratelimitkeybuilderproblem/)
- [`RateLimitRefundUnsupportedProblem`](/api/ratelimit-core/src/classes/ratelimitrefundunsupportedproblem/)
- [`RateLimitWindowProblem`](/api/ratelimit-core/src/classes/ratelimitwindowproblem/)
- [`RateLimitExceededProblem`](/api/ratelimit-core/src/classes/ratelimitexceededproblem/)
- [`InvalidRateLimitPolicyProblem`](/api/ratelimit-upstash/src/classes/invalidratelimitpolicyproblem/)
- [`MissingUpstashRateLimitConfigProblem`](/api/ratelimit-upstash/src/classes/missingupstashratelimitconfigproblem/)
- [`UpstashRateLimitUpstreamProblem`](/api/ratelimit-upstash/src/classes/upstashratelimitupstreamproblem/)
- [`BatchLoaderFactoryNotRegisteredProblem`](/api/repository-core/src/classes/batchloaderfactorynotregisteredproblem/)
- [`BatchLoaderFactoryResolutionProblem`](/api/repository-core/src/classes/batchloaderfactoryresolutionproblem/)
- [`BatchLoaderScopeCollisionProblem`](/api/repository-core/src/classes/batchloaderscopecollisionproblem/)
- [`CircuitBreakerOpenProblem`](/api/retry-core/src/classes/circuitbreakeropenproblem/)
- [`DuplicateRecoverHandlerProblem`](/api/retry-core/src/classes/duplicaterecoverhandlerproblem/)
- [`LambdaTimeoutProblem`](/api/retry-core/src/classes/lambdatimeoutproblem/)
- [`RetryAbortedProblem`](/api/retry-core/src/classes/retryabortedproblem/)
- [`RetryExhaustedProblem`](/api/retry-core/src/classes/retryexhaustedproblem/)
- [`CircuitBreakerUnexpectedStateProblem`](/api/retry-core/src/classes/circuitbreakerunexpectedstateproblem/)
- [`IndexNotFoundProblem`](/api/search-core/src/classes/indexnotfoundproblem/)
- [`MissingTenantProblem`](/api/search-core/src/classes/missingtenantproblem/)
- [`SearchCapabilityUnavailableProblem`](/api/search-core/src/classes/searchcapabilityunavailableproblem/)
- [`StrategyUnavailableProblem`](/api/search-core/src/classes/strategyunavailableproblem/)
- [`TransformNotFoundProblem`](/api/search-core/src/classes/transformnotfoundproblem/)
- [`MeilisearchIndexNotFoundProblem`](/api/search-meilisearch/src/classes/meilisearchindexnotfoundproblem/)
- [`MeilisearchInvalidRequestProblem`](/api/search-meilisearch/src/classes/meilisearchinvalidrequestproblem/)
- [`MeilisearchRetryableUpstreamProblem`](/api/search-meilisearch/src/classes/meilisearchretryableupstreamproblem/)
- [`MeilisearchTerminalUpstreamProblem`](/api/search-meilisearch/src/classes/meilisearchterminalupstreamproblem/)
- [`MissingMeilisearchConfigProblem`](/api/search-meilisearch/src/classes/missingmeilisearchconfigproblem/)
- [`TenantTokenNotConfiguredProblem`](/api/search-meilisearch/src/classes/tenanttokennotconfiguredproblem/)
- [`CloudflareImagesMissingConfigProblem`](/api/storage-cloudflare/src/classes/cloudflareimagesmissingconfigproblem/)
- [`CloudflareImagesRetryableUpstreamProblem`](/api/storage-cloudflare/src/classes/cloudflareimagesretryableupstreamproblem/)
- [`CloudflareImagesTerminalUpstreamProblem`](/api/storage-cloudflare/src/classes/cloudflareimagesterminalupstreamproblem/)
- [`CloudflareImagesValidationProblem`](/api/storage-cloudflare/src/classes/cloudflareimagesvalidationproblem/)
- [`CloudinaryMissingConfigProblem`](/api/storage-cloudinary/src/classes/cloudinarymissingconfigproblem/)
- [`CloudinaryRetryableUpstreamProblem`](/api/storage-cloudinary/src/classes/cloudinaryretryableupstreamproblem/)
- [`CloudinaryTerminalUpstreamProblem`](/api/storage-cloudinary/src/classes/cloudinaryterminalupstreamproblem/)
- [`CloudinaryValidationProblem`](/api/storage-cloudinary/src/classes/cloudinaryvalidationproblem/)
- [`StorageProblem`](/api/storage-core/src/classes/storageproblem/)
- [`OtlpEndpointRequiredProblem`](/api/telemetry-sdk-node/src/classes/otlpendpointrequiredproblem/)
- [`SamplerProblem`](/api/telemetry-sdk-node/src/classes/samplerproblem/)
- [`DuplicateTaskRegistrationProblem`](/api/tasks-core/src/classes/duplicatetaskregistrationproblem/)
- [`TaskNotFoundProblem`](/api/tasks-core/src/classes/tasknotfoundproblem/)
- [`TaskRunnerDIFailureProblem`](/api/tasks-core/src/classes/taskrunnerdifailureproblem/)
- [`QStashTaskConfigProblem`](/api/tasks-qstash/src/classes/qstashtaskconfigproblem/)
- [`QStashTaskPublishProblem`](/api/tasks-qstash/src/classes/qstashtaskpublishproblem/)
- [`QStashTaskValidationProblem`](/api/tasks-qstash/src/classes/qstashtaskvalidationproblem/)
- [`DuplicateTenantManagerRegistrationProblem`](/api/tenant-core/src/classes/duplicatetenantmanagerregistrationproblem/)
- [`TenantManagerNotRegisteredProblem`](/api/tenant-core/src/classes/tenantmanagernotregisteredproblem/)
- [`TenantNotFoundProblem`](/api/tenant-core/src/classes/tenantnotfoundproblem/)
- [`TenantRequiredProblem`](/api/tenant-core/src/classes/tenantrequiredproblem/)
- [`GraphQLRequestBodyAbortedProblem`](/api/transports-graphql/src/classes/graphqlrequestbodyabortedproblem/)
- [`GraphQLRequestBodyTooLargeProblem`](/api/transports-graphql/src/classes/graphqlrequestbodytoolargeproblem/)
- [`GraphQLResolversNotConfiguredProblem`](/api/transports-graphql/src/classes/graphqlresolversnotconfiguredproblem/)
- [`GraphQLSchemaNotConfiguredProblem`](/api/transports-graphql/src/classes/graphqlschemanotconfiguredproblem/)
- [`GraphQLServerNotInitializedProblem`](/api/transports-graphql/src/classes/graphqlservernotinitializedproblem/)
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
- [`DuplicateWorkflowRegistrationProblem`](/api/workflow-core/src/classes/duplicateworkflowregistrationproblem/)
- [`SagaDefinitionProblem`](/api/workflow-core/src/classes/sagadefinitionproblem/)
- [`SagaExecutionFailedProblem`](/api/workflow-core/src/classes/sagaexecutionfailedproblem/)
- [`SagaExecutionNotFoundProblem`](/api/workflow-core/src/classes/sagaexecutionnotfoundproblem/)
- [`SagaReplayProblem`](/api/workflow-core/src/classes/sagareplayproblem/)
- [`SagaStoreConflictProblem`](/api/workflow-core/src/classes/sagastoreconflictproblem/)
- [`WorkflowDefinitionProblem`](/api/workflow-core/src/classes/workflowdefinitionproblem/)
- [`WorkflowNotFoundProblem`](/api/workflow-core/src/classes/workflownotfoundproblem/)
- [`WorkflowReplayUnsupportedProblem`](/api/workflow-core/src/classes/workflowreplayunsupportedproblem/)

## Properties

### category

> `readonly` **category**: [`ProblemCategory`](/api/problems-core/src/enumerations/problemcategory/)

---

### cause?

> `readonly` `optional` **cause?**: `Error`

#### Overrides

`Error.cause`

---

### code

> `readonly` **code**: `string`

---

### detail?

> `readonly` `optional` **detail?**: `string`

---

### extensions?

> `readonly` `optional` **extensions?**: [`ProblemExtensions`](/api/problems-core/src/type-aliases/problemextensions/)

---

### instance?

> `readonly` `optional` **instance?**: `string`

---

### message

> **message**: `string`

#### Inherited from

`Error.message`

---

### name

> **name**: `string`

#### Inherited from

`Error.name`

---

### stack?

> `optional` **stack?**: `string`

#### Inherited from

`Error.stack`

---

### type

> `readonly` **type**: `string`

---

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

---

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

---

### captureStackTrace()

> `static` **captureStackTrace**(`targetObject`, `constructorOpt?`): `void`

Creates a `.stack` property on `targetObject`, which when accessed returns
a string representing the location in the code at which
`Error.captureStackTrace()` was called.

```js
const myObject = {};
Error.captureStackTrace(myObject);
myObject.stack; // Similar to `new Error().stack`
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

---

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
