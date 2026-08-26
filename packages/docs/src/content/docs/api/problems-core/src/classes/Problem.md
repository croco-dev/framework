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
- [`ProblemStatusMismatchError`](/api/frontend-problems/src/classes/problemstatusmismatcherror/)
- [`ProblemFetchUnavailableError`](/api/frontend-problems/src/classes/problemfetchunavailableerror/)
- [`BetterAuthAuthenticationProblem`](/api/auth-better-auth/src/classes/betterauthauthenticationproblem/)
- [`BetterAuthNotInitializedProblem`](/api/auth-better-auth/src/classes/betterauthnotinitializedproblem/)
- [`BetterAuthSessionNotFoundProblem`](/api/auth-better-auth/src/classes/betterauthsessionnotfoundproblem/)
- [`BetterAuthUserNotFoundProblem`](/api/auth-better-auth/src/classes/betterauthusernotfoundproblem/)
- [`BetterAuthInvalidSessionProblem`](/api/auth-better-auth/src/classes/betterauthinvalidsessionproblem/)
- [`BetterAuthSessionLookupProblem`](/api/auth-better-auth/src/classes/betterauthsessionlookupproblem/)
- [`InvalidWebhookSignatureProblem`](/api/auth-better-auth/src/classes/invalidwebhooksignatureproblem/)
- [`InvalidWebhookPayloadProblem`](/api/auth-better-auth/src/classes/invalidwebhookpayloadproblem/)
- [`InvalidBatchChunkSizeProblem`](/api/batch-core/src/classes/invalidbatchchunksizeproblem/)
- [`InvalidBatchStepNameProblem`](/api/batch-core/src/classes/invalidbatchstepnameproblem/)
- [`DuplicateBatchStepNameProblem`](/api/batch-core/src/classes/duplicatebatchstepnameproblem/)
- [`QStashBatchConfigProblem`](/api/batch-qstash/src/classes/qstashbatchconfigproblem/)
- [`QStashBatchValidationProblem`](/api/batch-qstash/src/classes/qstashbatchvalidationproblem/)
- [`QStashBatchPublishProblem`](/api/batch-qstash/src/classes/qstashbatchpublishproblem/)
- [`ConfigSchemaNotFoundProblem`](/api/framework-config/src/classes/configschemanotfoundproblem/)
- [`ConfigValidationProblem`](/api/framework-config/src/classes/configvalidationproblem/)
- [`InvalidBooleanEnvProblem`](/api/framework-config/src/classes/invalidbooleanenvproblem/)
- [`RuntimeEnvPresetBoundaryProblem`](/api/framework-config/src/classes/runtimeenvpresetboundaryproblem/)
- [`InvalidImpersonationConfigurationProblem`](/api/impersonation-core/src/classes/invalidimpersonationconfigurationproblem/)
- [`SelfImpersonationProblem`](/api/impersonation-core/src/classes/selfimpersonationproblem/)
- [`ImpersonationIdentityConflictProblem`](/api/impersonation-core/src/classes/impersonationidentityconflictproblem/)
- [`ImpersonationTargetNotFoundProblem`](/api/impersonation-core/src/classes/impersonationtargetnotfoundproblem/)
- [`NestedImpersonationProblem`](/api/impersonation-core/src/classes/nestedimpersonationproblem/)
- [`ImpersonationReasonRequiredProblem`](/api/impersonation-core/src/classes/impersonationreasonrequiredproblem/)
- [`BlockedDuringImpersonationProblem`](/api/impersonation-core/src/classes/blockedduringimpersonationproblem/)
- [`ImpersonationSessionNotFoundProblem`](/api/impersonation-core/src/classes/impersonationsessionnotfoundproblem/)
- [`ImpersonationSessionActorMismatchProblem`](/api/impersonation-core/src/classes/impersonationsessionactormismatchproblem/)
- [`ImpersonationLifecyclePublicationProblem`](/api/impersonation-core/src/classes/impersonationlifecyclepublicationproblem/)
- [`ImpersonationEventIntentConflictProblem`](/api/impersonation-core/src/classes/impersonationeventintentconflictproblem/)
- [`InvalidImpersonationEventIntentLimitProblem`](/api/impersonation-core/src/classes/invalidimpersonationeventintentlimitproblem/)
- [`InvitationTokenCipherProblem`](/api/invitation-drizzle/src/classes/invitationtokencipherproblem/)
- [`NotificationProviderNotConfiguredProblem`](/api/notifications-core/src/classes/notificationprovidernotconfiguredproblem/)
- [`NotificationProviderNotRegisteredProblem`](/api/notifications-core/src/classes/notificationprovidernotregisteredproblem/)
- [`NotificationProviderAlreadyRegisteredProblem`](/api/notifications-core/src/classes/notificationprovideralreadyregisteredproblem/)
- [`NotificationProviderCapabilitiesMissingProblem`](/api/notifications-core/src/classes/notificationprovidercapabilitiesmissingproblem/)
- [`NotificationProviderCapabilityNameMismatchProblem`](/api/notifications-core/src/classes/notificationprovidercapabilitynamemismatchproblem/)
- [`NotificationProviderCapabilityChannelMismatchProblem`](/api/notifications-core/src/classes/notificationprovidercapabilitychannelmismatchproblem/)
- [`NotificationDefaultProviderConflictProblem`](/api/notifications-core/src/classes/notificationdefaultproviderconflictproblem/)
- [`NotificationProviderChannelMismatchProblem`](/api/notifications-core/src/classes/notificationproviderchannelmismatchproblem/)
- [`NotificationProviderNotFoundProblem`](/api/notifications-core/src/classes/notificationprovidernotfoundproblem/)
- [`NotificationProviderIdempotencyUnsupportedProblem`](/api/notifications-core/src/classes/notificationprovideridempotencyunsupportedproblem/)
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
- [`InvalidSearchQueryProblem`](/api/search-drizzle/src/classes/invalidsearchqueryproblem/)
- [`BulkIndexChunkFailedProblem`](/api/search-drizzle/src/classes/bulkindexchunkfailedproblem/)
- [`BulkIndexDocumentTooWideProblem`](/api/search-drizzle/src/classes/bulkindexdocumenttoowideproblem/)
- [`BadRequestProblem`](/api/access-core/src/classes/badrequestproblem/)
- [`ForbiddenProblem`](/api/access-core/src/classes/forbiddenproblem/)
- [`CreditOperationsValidationProblem`](/api/admin-core/src/classes/creditoperationsvalidationproblem/)
- [`AdminResourceValidationProblem`](/api/admin-core/src/classes/adminresourcevalidationproblem/)
- [`WebhookOperationsActionValidationProblem`](/api/admin-core/src/classes/webhookoperationsactionvalidationproblem/)
- [`AdminGeneratedContractProblem`](/api/admin-generated/src/classes/admingeneratedcontractproblem/)
- [`PostHogAnalyticsCaptureProblem`](/api/analytics-posthog/src/classes/posthoganalyticscaptureproblem/)
- [`PostHogAnalyticsFlushProblem`](/api/analytics-posthog/src/classes/posthoganalyticsflushproblem/)
- [`PostHogAnalyticsGroupProblem`](/api/analytics-posthog/src/classes/posthoganalyticsgroupproblem/)
- [`PostHogAnalyticsIdentifyProblem`](/api/analytics-posthog/src/classes/posthoganalyticsidentifyproblem/)
- [`PostHogAnalyticsReadinessProblem`](/api/analytics-posthog/src/classes/posthoganalyticsreadinessproblem/)
- [`AuditableDecoratorProblem`](/api/audit-core/src/classes/auditabledecoratorproblem/)
- [`AuditClientIpConfigurationProblem`](/api/audit-core/src/classes/auditclientipconfigurationproblem/)
- [`ClerkWebhookDeliveryFailedProblem`](/api/auth-clerk/src/classes/clerkwebhookdeliveryfailedproblem/)
- [`ClerkWebhookDeliveryInFlightProblem`](/api/auth-clerk/src/classes/clerkwebhookdeliveryinflightproblem/)
- [`ClerkExternalServiceProblem`](/api/auth-clerk/src/classes/clerkexternalserviceproblem/)
- [`ClerkMalformedClaimProblem`](/api/auth-clerk/src/classes/clerkmalformedclaimproblem/)
- [`ClerkPublicUserDataMissingProblem`](/api/auth-clerk/src/classes/clerkpublicuserdatamissingproblem/)
- [`ClerkTokenVerificationProblem`](/api/auth-clerk/src/classes/clerktokenverificationproblem/)
- [`ClerkTokenVerificationUpstreamProblem`](/api/auth-clerk/src/classes/clerktokenverificationupstreamproblem/)
- [`DuplicateTenantMappingProblem`](/api/auth-clerk/src/classes/duplicatetenantmappingproblem/)
- [`InvalidWebhookPayloadProblem`](/api/auth-clerk/src/classes/invalidwebhookpayloadproblem/)
- [`UnexpectedTenantMappingClaimProblem`](/api/auth-clerk/src/classes/unexpectedtenantmappingclaimproblem/)
- [`WebhookVerificationProblem`](/api/auth-clerk/src/classes/webhookverificationproblem/)
- [`ApiKeyRotationProtectionProblem`](/api/auth-core/src/classes/apikeyrotationprotectionproblem/)
- [`ApiKeyCreationFailedProblem`](/api/auth-core/src/classes/apikeycreationfailedproblem/)
- [`ApiKeyExpiredProblem`](/api/auth-core/src/classes/apikeyexpiredproblem/)
- [`ApiKeyRotationConflictProblem`](/api/auth-core/src/classes/apikeyrotationconflictproblem/)
- [`ApiKeyRevokedProblem`](/api/auth-core/src/classes/apikeyrevokedproblem/)
- [`InvalidApiKeyRotationIdempotencyKeyProblem`](/api/auth-core/src/classes/invalidapikeyrotationidempotencykeyproblem/)
- [`AuthProviderUnavailableProblem`](/api/auth-core/src/classes/authproviderunavailableproblem/)
- [`ForbiddenProblem`](/api/auth-core/src/classes/forbiddenproblem/)
- [`InvalidPermissionActionProblem`](/api/auth-core/src/classes/invalidpermissionactionproblem/)
- [`InvalidPermissionFormatProblem`](/api/auth-core/src/classes/invalidpermissionformatproblem/)
- [`InvalidRouteMetadataTargetProblem`](/api/auth-core/src/classes/invalidroutemetadatatargetproblem/)
- [`UnauthorizedProblem`](/api/auth-core/src/classes/unauthorizedproblem/)
- [`DuplicateTenantMappingProblem`](/api/auth-drizzle/src/classes/duplicatetenantmappingproblem/)
- [`TenantMappingConflictResolutionProblem`](/api/auth-drizzle/src/classes/tenantmappingconflictresolutionproblem/)
- [`BillingAccountNotFoundProblem`](/api/billing-core/src/classes/billingaccountnotfoundproblem/)
- [`BillingAccountTenantConflictProblem`](/api/billing-core/src/classes/billingaccounttenantconflictproblem/)
- [`BillingCheckoutCreationProblem`](/api/billing-core/src/classes/billingcheckoutcreationproblem/)
- [`BillingCheckoutInProgressProblem`](/api/billing-core/src/classes/billingcheckoutinprogressproblem/)
- [`BillingLifecycleCommandConflictProblem`](/api/billing-core/src/classes/billinglifecyclecommandconflictproblem/)
- [`BillingLifecycleCommandInProgressProblem`](/api/billing-core/src/classes/billinglifecyclecommandinprogressproblem/)
- [`BillingLifecycleCommandNotFoundProblem`](/api/billing-core/src/classes/billinglifecyclecommandnotfoundproblem/)
- [`InvalidBillingLifecycleIdempotencyKeyProblem`](/api/billing-core/src/classes/invalidbillinglifecycleidempotencykeyproblem/)
- [`InvalidMoneyAmountProblem`](/api/billing-core/src/classes/invalidmoneyamountproblem/)
- [`InvalidMoneyCurrencyProblem`](/api/billing-core/src/classes/invalidmoneycurrencyproblem/)
- [`InvalidPlanVersionDefinitionProblem`](/api/billing-core/src/classes/invalidplanversiondefinitionproblem/)
- [`InvalidPlanVersionRefProblem`](/api/billing-core/src/classes/invalidplanversionrefproblem/)
- [`MoneyCurrencyMismatchProblem`](/api/billing-core/src/classes/moneycurrencymismatchproblem/)
- [`MoneyDivisionByZeroProblem`](/api/billing-core/src/classes/moneydivisionbyzeroproblem/)
- [`PlanVersionAlreadyPublishedProblem`](/api/billing-core/src/classes/planversionalreadypublishedproblem/)
- [`PlanVersionConflictProblem`](/api/billing-core/src/classes/planversionconflictproblem/)
- [`ProviderCapabilityUnavailableProblem`](/api/billing-core/src/classes/providercapabilityunavailableproblem/)
- [`InvalidSubscriptionQuantityProblem`](/api/billing-core/src/classes/invalidsubscriptionquantityproblem/)
- [`SubscriptionQuantityReconciliationConflictProblem`](/api/billing-core/src/classes/subscriptionquantityreconciliationconflictproblem/)
- [`SubscriptionQuantityReconciliationFailedProblem`](/api/billing-core/src/classes/subscriptionquantityreconciliationfailedproblem/)
- [`SubscriptionQuantityProviderMismatchProblem`](/api/billing-core/src/classes/subscriptionquantityprovidermismatchproblem/)
- [`SubscriptionQuantityProviderSourceAheadProblem`](/api/billing-core/src/classes/subscriptionquantityprovidersourceaheadproblem/)
- [`SubscriptionQuantitySourceMismatchProblem`](/api/billing-core/src/classes/subscriptionquantitysourcemismatchproblem/)
- [`SubscriptionPlanVersionMismatchProblem`](/api/billing-core/src/classes/subscriptionplanversionmismatchproblem/)
- [`SubscriptionNotFoundProblem`](/api/billing-core/src/classes/subscriptionnotfoundproblem/)
- [`UnknownPlanVersionProblem`](/api/billing-core/src/classes/unknownplanversionproblem/)
- [`UnknownProviderPlanMappingProblem`](/api/billing-core/src/classes/unknownproviderplanmappingproblem/)
- [`WebhookAlreadyProcessedProblem`](/api/billing-core/src/classes/webhookalreadyprocessedproblem/)
- [`WebhookEventIntentsPendingProblem`](/api/billing-core/src/classes/webhookeventintentspendingproblem/)
- [`InvalidPlanReleaseScheduleProblem`](/api/billing-core/src/classes/invalidplanreleasescheduleproblem/)
- [`InvalidPlanReleaseTransitionProblem`](/api/billing-core/src/classes/invalidplanreleasetransitionproblem/)
- [`OverlappingPlanEffectivePeriodProblem`](/api/billing-core/src/classes/overlappingplaneffectiveperiodproblem/)
- [`PlanReleaseProviderCapabilityProblem`](/api/billing-core/src/classes/planreleaseprovidercapabilityproblem/)
- [`PlanReleasePublishConflictProblem`](/api/billing-core/src/classes/planreleasepublishconflictproblem/)
- [`PlanReleaseValidationFailedProblem`](/api/billing-core/src/classes/planreleasevalidationfailedproblem/)
- [`StalePlanReleaseRevisionProblem`](/api/billing-core/src/classes/staleplanreleaserevisionproblem/)
- [`BillingStatusMappingProblem`](/api/billing-polar/src/classes/billingstatusmappingproblem/)
- [`PolarCheckoutIdempotencyConflictProblem`](/api/billing-polar/src/classes/polarcheckoutidempotencyconflictproblem/)
- [`PolarCustomerNotFoundProblem`](/api/billing-polar/src/classes/polarcustomernotfoundproblem/)
- [`PolarMissingConfigProblem`](/api/billing-polar/src/classes/polarmissingconfigproblem/)
- [`PolarRetryableUpstreamProblem`](/api/billing-polar/src/classes/polarretryableupstreamproblem/)
- [`PolarSubscriptionNotFoundProblem`](/api/billing-polar/src/classes/polarsubscriptionnotfoundproblem/)
- [`PolarTerminalUpstreamProblem`](/api/billing-polar/src/classes/polarterminalupstreamproblem/)
- [`PolarUsageCustomerNotFoundProblem`](/api/billing-polar/src/classes/polarusagecustomernotfoundproblem/)
- [`PolarUsageMeterMappingProblem`](/api/billing-polar/src/classes/polarusagemetermappingproblem/)
- [`PolarValidationProblem`](/api/billing-polar/src/classes/polarvalidationproblem/)
- [`WebhookProcessingProblem`](/api/billing-polar/src/classes/webhookprocessingproblem/)
- [`WebhookValidationProblem`](/api/billing-polar/src/classes/webhookvalidationproblem/)
- [`CacheDecoratorConfigProblem`](/api/cache-core/src/classes/cachedecoratorconfigproblem/)
- [`CacheKeyArgumentProblem`](/api/cache-core/src/classes/cachekeyargumentproblem/)
- [`CacheInvalidationAssertionProblem`](/api/cache-core/src/classes/cacheinvalidationassertionproblem/)
- [`CacheInvalidationFailedProblem`](/api/cache-core/src/classes/cacheinvalidationfailedproblem/)
- [`CacheInvalidationGraphProblem`](/api/cache-core/src/classes/cacheinvalidationgraphproblem/)
- [`UnknownCacheInvalidationEventProblem`](/api/cache-core/src/classes/unknowncacheinvalidationeventproblem/)
- [`UnsupportedCacheInvalidationCapabilityProblem`](/api/cache-core/src/classes/unsupportedcacheinvalidationcapabilityproblem/)
- [`InvalidCacheConfigurationProblem`](/api/cache-core/src/classes/invalidcacheconfigurationproblem/)
- [`InvalidCacheTtlProblem`](/api/cache-core/src/classes/invalidcachettlproblem/)
- [`CreditAccountMismatchProblem`](/api/credits-core/src/classes/creditaccountmismatchproblem/)
- [`CreditAccountNotFoundProblem`](/api/credits-core/src/classes/creditaccountnotfoundproblem/)
- [`CreditDuplicateConflictProblem`](/api/credits-core/src/classes/creditduplicateconflictproblem/)
- [`CreditEventPublicationProblem`](/api/credits-core/src/classes/crediteventpublicationproblem/)
- [`CreditRefundMismatchProblem`](/api/credits-core/src/classes/creditrefundmismatchproblem/)
- [`CreditReservationMismatchProblem`](/api/credits-core/src/classes/creditreservationmismatchproblem/)
- [`CreditTransactionNotFoundProblem`](/api/credits-core/src/classes/credittransactionnotfoundproblem/)
- [`ExpiredGrantProblem`](/api/credits-core/src/classes/expiredgrantproblem/)
- [`InsufficientCreditsProblem`](/api/credits-core/src/classes/insufficientcreditsproblem/)
- [`InvalidCreditAmountProblem`](/api/credits-core/src/classes/invalidcreditamountproblem/)
- [`InvalidCreditCommandProblem`](/api/credits-core/src/classes/invalidcreditcommandproblem/)
- [`StaleLedgerPositionProblem`](/api/credits-core/src/classes/staleledgerpositionproblem/)
- [`CreditLedgerPersistenceProblem`](/api/credits-drizzle/src/classes/creditledgerpersistenceproblem/)
- [`HealthEventIntentConflictProblem`](/api/customer-health-core/src/classes/healtheventintentconflictproblem/)
- [`HealthEventPublisherNotConfiguredProblem`](/api/customer-health-core/src/classes/healtheventpublishernotconfiguredproblem/)
- [`HealthScoreNotFoundProblem`](/api/customer-health-core/src/classes/healthscorenotfoundproblem/)
- [`HealthTransitionPersistenceRetryExhaustedProblem`](/api/customer-health-core/src/classes/healthtransitionpersistenceretryexhaustedproblem/)
- [`InvalidHealthScoreInputProblem`](/api/customer-health-core/src/classes/invalidhealthscoreinputproblem/)
- [`HealthTransitionSequenceMissingProblem`](/api/customer-health-drizzle/src/classes/healthtransitionsequencemissingproblem/)
- [`InvalidMeteringInputProblem`](/api/customer-health-drizzle/src/classes/invalidmeteringinputproblem/)
- [`BatchResultLengthMismatchProblem`](/api/dataloader-core/src/classes/batchresultlengthmismatchproblem/)
- [`DesktopPreloadGenerationProblem`](/api/desktop-codegen/src/classes/desktoppreloadgenerationproblem/)
- [`DesktopRendererGenerationProblem`](/api/desktop-codegen/src/classes/desktoprenderergenerationproblem/)
- [`DuplicateDiagnosticsProviderProblem`](/api/diagnostics-core/src/classes/duplicatediagnosticsproviderproblem/)
- [`InvalidDiagnosticsTimeoutProblem`](/api/diagnostics-core/src/classes/invaliddiagnosticstimeoutproblem/)
- [`EntitlementDefinitionProblem`](/api/entitlements-core/src/classes/entitlementdefinitionproblem/)
- [`EntitlementDeniedProblem`](/api/entitlements-core/src/classes/entitlementdeniedproblem/)
- [`EntitlementInactiveSubscriptionProblem`](/api/entitlements-core/src/classes/entitlementinactivesubscriptionproblem/)
- [`EntitlementMissingPlanProblem`](/api/entitlements-core/src/classes/entitlementmissingplanproblem/)
- [`EntitlementNotFoundProblem`](/api/entitlements-core/src/classes/entitlementnotfoundproblem/)
- [`EntitlementPlanVersionAlreadyRegisteredProblem`](/api/entitlements-core/src/classes/entitlementplanversionalreadyregisteredproblem/)
- [`EntitlementPlanVersionMismatchProblem`](/api/entitlements-core/src/classes/entitlementplanversionmismatchproblem/)
- [`EntitlementPlanVersionNotFoundProblem`](/api/entitlements-core/src/classes/entitlementplanversionnotfoundproblem/)
- [`EntitlementProviderUnavailableProblem`](/api/entitlements-core/src/classes/entitlementproviderunavailableproblem/)
- [`EntitlementQuotaExceededProblem`](/api/entitlements-core/src/classes/entitlementquotaexceededproblem/)
- [`EntitlementRequirementProblem`](/api/entitlements-core/src/classes/entitlementrequirementproblem/)
- [`DuplicateEventFieldProblem`](/api/events-core/src/classes/duplicateeventfieldproblem/)
- [`DuplicateEventNameProblem`](/api/events-core/src/classes/duplicateeventnameproblem/)
- [`EventAfterCommitOutcomeRequiredProblem`](/api/events-core/src/classes/eventaftercommitoutcomerequiredproblem/)
- [`EventAfterCommitRequiresActiveTransactionProblem`](/api/events-core/src/classes/eventaftercommitrequiresactivetransactionproblem/)
- [`EventBusNotSetProblem`](/api/events-core/src/classes/eventbusnotsetproblem/)
- [`EventDefinitionProblem`](/api/events-core/src/classes/eventdefinitionproblem/)
- [`EventDeserializationError`](/api/events-core/src/classes/eventdeserializationerror/)
- [`EventTransactionContextUnavailableProblem`](/api/events-core/src/classes/eventtransactioncontextunavailableproblem/)
- [`UnknownEventTypeProblem`](/api/events-core/src/classes/unknowneventtypeproblem/)
- [`EventPublishDroppedProblem`](/api/events-inmemory/src/classes/eventpublishdroppedproblem/)
- [`EventPublishFailedError`](/api/events-inmemory/src/classes/eventpublishfailederror/)
- [`BackpressureExceededProblem`](/api/events-inmemory/src/classes/backpressureexceededproblem/)
- [`BackpressureTimeoutProblem`](/api/events-inmemory/src/classes/backpressuretimeoutproblem/)
- [`InvalidEventBusConfigurationProblem`](/api/events-inmemory/src/classes/invalideventbusconfigurationproblem/)
- [`InboxClaimConflictProblem`](/api/events-tx/src/classes/inboxclaimconflictproblem/)
- [`InvalidTransactionalEventConfigurationProblem`](/api/events-tx/src/classes/invalidtransactionaleventconfigurationproblem/)
- [`OutboxIdempotencyConflictProblem`](/api/events-tx/src/classes/outboxidempotencyconflictproblem/)
- [`OutboxMessageIdConflictProblem`](/api/events-tx/src/classes/outboxmessageidconflictproblem/)
- [`OutboxPublishExhaustedProblem`](/api/events-tx/src/classes/outboxpublishexhaustedproblem/)
- [`OutboxStorageProblem`](/api/events-tx/src/classes/outboxstorageproblem/)
- [`OutboxTransactionRequiredProblem`](/api/events-tx/src/classes/outboxtransactionrequiredproblem/)
- [`TransactionStateProblem`](/api/events-tx/src/classes/transactionstateproblem/)
- [`ExecutionProblem`](/api/execution-core/src/classes/executionproblem/)
- [`InvalidContinuationLeaseDurationProblem`](/api/execution-core/src/classes/invalidcontinuationleasedurationproblem/)
- [`MessageDataInvalidProblem`](/api/engagement-core/src/classes/messagedatainvalidproblem/)
- [`MessageDefinitionInvalidProblem`](/api/engagement-core/src/classes/messagedefinitioninvalidproblem/)
- [`MessageRendererAlreadyRegisteredProblem`](/api/engagement-core/src/classes/messagerendereralreadyregisteredproblem/)
- [`MessageRendererBindingMismatchProblem`](/api/engagement-core/src/classes/messagerendererbindingmismatchproblem/)
- [`MessageRendererChannelMissingProblem`](/api/engagement-core/src/classes/messagerendererchannelmissingproblem/)
- [`MessageRendererMessageMissingProblem`](/api/engagement-core/src/classes/messagerenderermessagemissingproblem/)
- [`MessageRendererMissingProblem`](/api/engagement-core/src/classes/messagerenderermissingproblem/)
- [`MessageRendererUndeclaredChannelProblem`](/api/engagement-core/src/classes/messagerendererundeclaredchannelproblem/)
- [`MessageAlreadyRegisteredProblem`](/api/engagement-core/src/classes/messagealreadyregisteredproblem/)
- [`EngagementCommandInvalidProblem`](/api/engagement-core/src/classes/engagementcommandinvalidproblem/)
- [`EngagementDispatchFailedProblem`](/api/engagement-core/src/classes/engagementdispatchfailedproblem/)
- [`EngagementRecordedDispatchFailureProblem`](/api/engagement-core/src/classes/engagementrecordeddispatchfailureproblem/)
- [`EngagementRenderFailedProblem`](/api/engagement-core/src/classes/engagementrenderfailedproblem/)
- [`EngagementSuppressionEvaluationProblem`](/api/engagement-core/src/classes/engagementsuppressionevaluationproblem/)
- [`RecipientDirectoryLookupProblem`](/api/engagement-core/src/classes/recipientdirectorylookupproblem/)
- [`RecipientDirectoryScopeMismatchProblem`](/api/engagement-core/src/classes/recipientdirectoryscopemismatchproblem/)
- [`RecipientNotFoundProblem`](/api/engagement-core/src/classes/recipientnotfoundproblem/)
- [`EngagementPersistenceProblem`](/api/engagement-core/src/classes/engagementpersistenceproblem/)
- [`EngagementStoreValidationProblem`](/api/engagement-core/src/classes/engagementstorevalidationproblem/)
- [`EngagementDeliveryEventCorrelationProblem`](/api/engagement-core/src/classes/engagementdeliveryeventcorrelationproblem/)
- [`RuntimeInspectorConfigurationProblem`](/api/framework-context/src/classes/runtimeinspectorconfigurationproblem/)
- [`ContainerResolutionProblem`](/api/framework-context/src/classes/containerresolutionproblem/)
- [`ContainerScopeMismatchProblem`](/api/framework-context/src/classes/containerscopemismatchproblem/)
- [`CircularDependencyProblem`](/api/framework-context/src/classes/circulardependencyproblem/)
- [`MiddlewareProblem`](/api/framework-context/src/classes/middlewareproblem/)
- [`PolicyCapabilityProblem`](/api/framework-context/src/classes/policycapabilityproblem/)
- [`PolicyConflictProblem`](/api/framework-context/src/classes/policyconflictproblem/)
- [`PolicyDefinitionProblem`](/api/framework-context/src/classes/policydefinitionproblem/)
- [`PipelineGraphProblem`](/api/framework-context/src/classes/pipelinegraphproblem/)
- [`InvalidShutdownTimeoutProblem`](/api/framework-context/src/classes/invalidshutdowntimeoutproblem/)
- [`OnShutdownDecoratorProblem`](/api/framework-context/src/classes/onshutdowndecoratorproblem/)
- [`ShutdownConfigurationConflictProblem`](/api/framework-context/src/classes/shutdownconfigurationconflictproblem/)
- [`ShutdownHookExecutionProblem`](/api/framework-context/src/classes/shutdownhookexecutionproblem/)
- [`ShutdownHookRegistrationClosedProblem`](/api/framework-context/src/classes/shutdownhookregistrationclosedproblem/)
- [`ShutdownTimeoutProblem`](/api/framework-context/src/classes/shutdowntimeoutproblem/)
- [`InvalidModuleDefinitionProblem`](/api/framework-module/src/classes/invalidmoduledefinitionproblem/)
- [`InvalidModuleLifecycleDeadlineProblem`](/api/framework-module/src/classes/invalidmodulelifecycledeadlineproblem/)
- [`ModuleCircularDependencyProblem`](/api/framework-module/src/classes/modulecirculardependencyproblem/)
- [`ModuleDuplicateNameProblem`](/api/framework-module/src/classes/moduleduplicatenameproblem/)
- [`ModuleLifecycleCancelledProblem`](/api/framework-module/src/classes/modulelifecyclecancelledproblem/)
- [`ModuleLifecycleDeadlineExceededProblem`](/api/framework-module/src/classes/modulelifecycledeadlineexceededproblem/)
- [`ModuleLifecycleProblem`](/api/framework-module/src/classes/modulelifecycleproblem/)
- [`ModuleProviderOwnershipProblem`](/api/framework-module/src/classes/moduleproviderownershipproblem/)
- [`ModuleProviderUnavailableProblem`](/api/framework-module/src/classes/moduleproviderunavailableproblem/)
- [`ModuleProviderVisibilityProblem`](/api/framework-module/src/classes/moduleprovidervisibilityproblem/)
- [`ModuleProviderWriteProblem`](/api/framework-module/src/classes/moduleproviderwriteproblem/)
- [`ModuleRegistrationConflictProblem`](/api/framework-module/src/classes/moduleregistrationconflictproblem/)
- [`ModuleRuntimeDisposedProblem`](/api/framework-module/src/classes/moduleruntimedisposedproblem/)
- [`ModuleRuntimeResetConflictProblem`](/api/framework-module/src/classes/moduleruntimeresetconflictproblem/)
- [`ModuleRuntimeStaleContextProblem`](/api/framework-module/src/classes/moduleruntimestalecontextproblem/)
- [`PageDataUnavailableProblem`](/api/frontend-react/src/classes/pagedataunavailableproblem/)
- [`MissingCloudflareVitePluginProblem`](/api/frontend-vite/src/classes/missingcloudflarevitepluginproblem/)
- [`InvalidIdPrefixProblem`](/api/gid-core/src/classes/invalididprefixproblem/)
- [`DuplicateIdPrefixProblem`](/api/gid-core/src/classes/duplicateidprefixproblem/)
- [`DataGovernanceValidationProblem`](/api/governance-core/src/classes/datagovernancevalidationproblem/)
- [`RetentionPolicyViolationProblem`](/api/governance-core/src/classes/retentionpolicyviolationproblem/)
- [`UnsupportedDataDeleteProblem`](/api/governance-core/src/classes/unsupporteddatadeleteproblem/)
- [`UnsupportedDataExportProblem`](/api/governance-core/src/classes/unsupporteddataexportproblem/)
- [`DuplicateHealthIndicatorProblem`](/api/health-core/src/classes/duplicatehealthindicatorproblem/)
- [`InvalidHealthIndicatorIdProblem`](/api/health-core/src/classes/invalidhealthindicatoridproblem/)
- [`InvalidHealthCheckTimeoutProblem`](/api/health-core/src/classes/invalidhealthchecktimeoutproblem/)
- [`PostHogConfigProblem`](/api/integrations-posthog/src/classes/posthogconfigproblem/)
- [`BatchSizeExceededProblem`](/api/invitation-core/src/classes/batchsizeexceededproblem/)
- [`DomainAutoJoinRecoveryProblem`](/api/invitation-core/src/classes/domainautojoinrecoveryproblem/)
- [`InvalidAutoJoinRoleProblem`](/api/invitation-core/src/classes/invalidautojoinroleproblem/)
- [`PublicEmailDomainNotAllowedProblem`](/api/invitation-core/src/classes/publicemaildomainnotallowedproblem/)
- [`InvalidInvitationExpiryDurationProblem`](/api/invitation-core/src/classes/invalidinvitationexpirydurationproblem/)
- [`InvitationAlreadyAcceptedProblem`](/api/invitation-core/src/classes/invitationalreadyacceptedproblem/)
- [`InvitationCreationFailedProblem`](/api/invitation-core/src/classes/invitationcreationfailedproblem/)
- [`InvitationEmailMismatchProblem`](/api/invitation-core/src/classes/invitationemailmismatchproblem/)
- [`InvitationExpiredProblem`](/api/invitation-core/src/classes/invitationexpiredproblem/)
- [`InvitationInvalidStatusProblem`](/api/invitation-core/src/classes/invitationinvalidstatusproblem/)
- [`InvitationNotFoundProblem`](/api/invitation-core/src/classes/invitationnotfoundproblem/)
- [`InvitationIdempotencyConflictProblem`](/api/invitation-core/src/classes/invitationidempotencyconflictproblem/)
- [`DuplicateInvitationProblem`](/api/invitation-core/src/classes/duplicateinvitationproblem/)
- [`InvitationRateLimitExceededProblem`](/api/invitation-core/src/classes/invitationratelimitexceededproblem/)
- [`DuplicateLifecycleRuleProblem`](/api/lifecycle-core/src/classes/duplicatelifecycleruleproblem/)
- [`InvalidWebhookTimeoutProblem`](/api/lifecycle-core/src/classes/invalidwebhooktimeoutproblem/)
- [`LifecycleActionAdapterProblem`](/api/lifecycle-core/src/classes/lifecycleactionadapterproblem/)
- [`LifecycleRunEvidenceProblem`](/api/lifecycle-core/src/classes/lifecyclerunevidenceproblem/)
- [`LifecycleRunFinalizationProblem`](/api/lifecycle-core/src/classes/lifecyclerunfinalizationproblem/)
- [`LifecycleRuleActionContractProblem`](/api/lifecycle-core/src/classes/lifecycleruleactioncontractproblem/)
- [`LifecycleRuleCommandConflictProblem`](/api/lifecycle-core/src/classes/lifecyclerulecommandconflictproblem/)
- [`LifecycleRuleDefinitionProblem`](/api/lifecycle-core/src/classes/lifecycleruledefinitionproblem/)
- [`LifecycleRuleTransitionProblem`](/api/lifecycle-core/src/classes/lifecycleruletransitionproblem/)
- [`LifecycleRuleVersionConflictProblem`](/api/lifecycle-core/src/classes/lifecycleruleversionconflictproblem/)
- [`LifecycleRuleVersionDefinitionProblem`](/api/lifecycle-core/src/classes/lifecycleruleversiondefinitionproblem/)
- [`MonetizationRecipeCapabilityProblem`](/api/lifecycle-core/src/classes/monetizationrecipecapabilityproblem/)
- [`MonetizationSignalDefinitionProblem`](/api/lifecycle-core/src/classes/monetizationsignaldefinitionproblem/)
- [`MonetizationThresholdClaimProblem`](/api/lifecycle-core/src/classes/monetizationthresholdclaimproblem/)
- [`UnavailableLifecycleRuleVersionProblem`](/api/lifecycle-core/src/classes/unavailablelifecycleruleversionproblem/)
- [`UnknownLifecycleRuleVersionProblem`](/api/lifecycle-core/src/classes/unknownlifecycleruleversionproblem/)
- [`InvalidLlmPromptProblem`](/api/llm-core/src/classes/invalidllmpromptproblem/)
- [`InvalidLlmResponseProblem`](/api/llm-core/src/classes/invalidllmresponseproblem/)
- [`LlmOperationAbortedProblem`](/api/llm-core/src/classes/llmoperationabortedproblem/)
- [`LlmProblem`](/api/llm-core/src/classes/llmproblem/)
- [`LlmProviderNotFoundProblem`](/api/llm-core/src/classes/llmprovidernotfoundproblem/)
- [`LlmRateLimitProblem`](/api/llm-core/src/classes/llmratelimitproblem/)
- [`LlmServiceNotInitializedProblem`](/api/llm-core/src/classes/llmservicenotinitializedproblem/)
- [`LlmTokenLimitExceededProblem`](/api/llm-core/src/classes/llmtokenlimitexceededproblem/)
- [`EmbeddingError`](/api/llm-core/src/classes/embeddingerror/)
- [`GenerationError`](/api/llm-core/src/classes/generationerror/)
- [`LlmCompletionEventPublicationProblem`](/api/llm-core/src/classes/llmcompletioneventpublicationproblem/)
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
- [`LlmMeteringServiceRequiredProblem`](/api/llm-metering/src/classes/llmmeteringservicerequiredproblem/)
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
- [`InvalidMembershipCommandProblem`](/api/membership-core/src/classes/invalidmembershipcommandproblem/)
- [`MembershipEventPublicationProblem`](/api/membership-core/src/classes/membershipeventpublicationproblem/)
- [`MembershipIdempotencyConflictProblem`](/api/membership-core/src/classes/membershipidempotencyconflictproblem/)
- [`ServerActionInvalidPathProblem`](/api/meta-vite/src/classes/serveractioninvalidpathproblem/)
- [`ServerActionNotFoundProblem`](/api/meta-vite/src/classes/serveractionnotfoundproblem/)
- [`ServerActionValidationProblem`](/api/meta-vite/src/classes/serveractionvalidationproblem/)
- [`AtomicQuotaNotSupportedProblem`](/api/metering-core/src/classes/atomicquotanotsupportedproblem/)
- [`BillableUsageJournalRequiredProblem`](/api/metering-core/src/classes/billableusagejournalrequiredproblem/)
- [`DuplicateRecordProblem`](/api/metering-core/src/classes/duplicaterecordproblem/)
- [`InvalidMeterDimensionProblem`](/api/metering-core/src/classes/invalidmeterdimensionproblem/)
- [`MeteringTransitionProblem`](/api/metering-core/src/classes/meteringtransitionproblem/)
- [`InvalidMeterProblem`](/api/metering-core/src/classes/invalidmeterproblem/)
- [`InvalidUsageEnvelopeProblem`](/api/metering-core/src/classes/invalidusageenvelopeproblem/)
- [`InvalidUsageQueryProblem`](/api/metering-core/src/classes/invalidusagequeryproblem/)
- [`InvalidUsageValueProblem`](/api/metering-core/src/classes/invalidusagevalueproblem/)
- [`QuotaExceededProblem`](/api/metering-core/src/classes/quotaexceededproblem/)
- [`RedisProblem`](/api/metering-core/src/classes/redisproblem/)
- [`UsageEnvelopeConfigurationProblem`](/api/metering-drizzle/src/classes/usageenvelopeconfigurationproblem/)
- [`MissingUpstashMeteringConfigProblem`](/api/metering-upstash/src/classes/missingupstashmeteringconfigproblem/)
- [`UpstashMeteringUpstreamProblem`](/api/metering-upstash/src/classes/upstashmeteringupstreamproblem/)
- [`BillingMetricDroppedProblem`](/api/metrics-billing/src/classes/billingmetricdroppedproblem/)
- [`BillingMetricRecordingProblem`](/api/metrics-billing/src/classes/billingmetricrecordingproblem/)
- [`CarryingCapacitySimulationProblem`](/api/metrics-core/src/classes/carryingcapacitysimulationproblem/)
- [`CarryingCapacityTenantRequiredProblem`](/api/metrics-core/src/classes/carryingcapacitytenantrequiredproblem/)
- [`GrossMarginRequiredProblem`](/api/metrics-core/src/classes/grossmarginrequiredproblem/)
- [`InvalidCarryingCapacityConfigProblem`](/api/metrics-core/src/classes/invalidcarryingcapacityconfigproblem/)
- [`InvalidRetentionMovementProblem`](/api/metrics-core/src/classes/invalidretentionmovementproblem/)
- [`MixedCurrencyMRRProblem`](/api/metrics-core/src/classes/mixedcurrencymrrproblem/)
- [`RetentionMetricsUnavailableProblem`](/api/metrics-core/src/classes/retentionmetricsunavailableproblem/)
- [`SnapshotTenantRequiredProblem`](/api/metrics-core/src/classes/snapshottenantrequiredproblem/)
- [`DatabaseUrlRequiredProblem`](/api/migration-runner/src/classes/databaseurlrequiredproblem/)
- [`InvalidMigrationCountProblem`](/api/migration-runner/src/classes/invalidmigrationcountproblem/)
- [`MigrationFileLoadProblem`](/api/migration-runner/src/classes/migrationfileloadproblem/)
- [`MigrationHistoryDriftProblem`](/api/migration-runner/src/classes/migrationhistorydriftproblem/)
- [`MigrationTransactionRequiredProblem`](/api/migration-runner/src/classes/migrationtransactionrequiredproblem/)
- [`MissingDownFunctionProblem`](/api/migration-runner/src/classes/missingdownfunctionproblem/)
- [`MissingUpFunctionProblem`](/api/migration-runner/src/classes/missingupfunctionproblem/)
- [`UnsupportedDialectProblem`](/api/migration-runner/src/classes/unsupporteddialectproblem/)
- [`UnsupportedMigrationQueryResultProblem`](/api/migration-runner/src/classes/unsupportedmigrationqueryresultproblem/)
- [`ReactEmailRenderProblem`](/api/notifications-react-email/src/classes/reactemailrenderproblem/)
- [`ResendIdempotencyConflictProblem`](/api/notifications-resend/src/classes/resendidempotencyconflictproblem/)
- [`ResendMissingConfigProblem`](/api/notifications-resend/src/classes/resendmissingconfigproblem/)
- [`ResendNotificationProblem`](/api/notifications-resend/src/classes/resendnotificationproblem/)
- [`ResendRetryableUpstreamProblem`](/api/notifications-resend/src/classes/resendretryableupstreamproblem/)
- [`ResendTerminalUpstreamProblem`](/api/notifications-resend/src/classes/resendterminalupstreamproblem/)
- [`ResendValidationProblem`](/api/notifications-resend/src/classes/resendvalidationproblem/)
- [`DuplicateOnboardingDefinitionProblem`](/api/onboarding-core/src/classes/duplicateonboardingdefinitionproblem/)
- [`OnboardingContextRequiredProblem`](/api/onboarding-core/src/classes/onboardingcontextrequiredproblem/)
- [`OnboardingDefinitionNotFoundProblem`](/api/onboarding-core/src/classes/onboardingdefinitionnotfoundproblem/)
- [`OnboardingStateSnapshotUnsupportedProblem`](/api/onboarding-core/src/classes/onboardingstatesnapshotunsupportedproblem/)
- [`OnboardingStepCompletionConflictProblem`](/api/onboarding-core/src/classes/onboardingstepcompletionconflictproblem/)
- [`OnboardingStepNotFoundProblem`](/api/onboarding-core/src/classes/onboardingstepnotfoundproblem/)
- [`OutboxClaimConfigurationProblem`](/api/outbox-core/src/classes/outboxclaimconfigurationproblem/)
- [`OutboxDispatchProblem`](/api/outbox-core/src/classes/outboxdispatchproblem/)
- [`OutboxFailureMetadataProblem`](/api/outbox-core/src/classes/outboxfailuremetadataproblem/)
- [`OutboxRecordIdConflictProblem`](/api/outbox-core/src/classes/outboxrecordidconflictproblem/)
- [`OutboxUnitOfWorkContextProblem`](/api/outbox-core/src/classes/outboxunitofworkcontextproblem/)
- [`AmbiguousPaginationParameterProblem`](/api/pagination-core/src/classes/ambiguouspaginationparameterproblem/)
- [`ConflictingPaginationProblem`](/api/pagination-core/src/classes/conflictingpaginationproblem/)
- [`InvalidCursorProblem`](/api/pagination-core/src/classes/invalidcursorproblem/)
- [`InvalidPaginationDirectionProblem`](/api/pagination-core/src/classes/invalidpaginationdirectionproblem/)
- [`NodeEntryCloseTimeoutProblem`](/api/preset-node/src/classes/nodeentryclosetimeoutproblem/)
- [`NodeEntryLifecycleIoProblem`](/api/preset-node/src/classes/nodeentrylifecycleioproblem/)
- [`NodeEntryLifecycleProblem`](/api/preset-node/src/classes/nodeentrylifecycleproblem/)
- [`ProblemRegistryValidationProblem`](/api/problems-core/src/classes/problemregistryvalidationproblem/)
- [`ControllerProjectConfigProblem`](/api/protocol-codegen/src/classes/controllerprojectconfigproblem/)
- [`ContractGraphDiagnosticError`](/api/protocols-core/src/classes/contractgraphdiagnosticerror/)
- [`DesktopDefinitionProblem`](/api/protocols-desktop/src/classes/desktopdefinitionproblem/)
- [`DesktopWireSchemaProblem`](/api/protocols-desktop/src/classes/desktopwireschemaproblem/)
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
- [`RateLimitPruneIntervalProblem`](/api/ratelimit-core/src/classes/ratelimitpruneintervalproblem/)
- [`RateLimitRefundUnsupportedProblem`](/api/ratelimit-core/src/classes/ratelimitrefundunsupportedproblem/)
- [`RateLimitWindowProblem`](/api/ratelimit-core/src/classes/ratelimitwindowproblem/)
- [`RateLimitExceededProblem`](/api/ratelimit-core/src/classes/ratelimitexceededproblem/)
- [`InvalidRateLimitPolicyProblem`](/api/ratelimit-upstash/src/classes/invalidratelimitpolicyproblem/)
- [`MissingUpstashRateLimitConfigProblem`](/api/ratelimit-upstash/src/classes/missingupstashratelimitconfigproblem/)
- [`UpstashRateLimitUpstreamProblem`](/api/ratelimit-upstash/src/classes/upstashratelimitupstreamproblem/)
- [`BatchLoadDuplicateResultKeyProblem`](/api/repository-core/src/classes/batchloadduplicateresultkeyproblem/)
- [`BatchLoaderFactoryNotRegisteredProblem`](/api/repository-core/src/classes/batchloaderfactorynotregisteredproblem/)
- [`BatchLoaderFactoryResolutionProblem`](/api/repository-core/src/classes/batchloaderfactoryresolutionproblem/)
- [`BatchLoadResultIdentityMismatchProblem`](/api/repository-core/src/classes/batchloadresultidentitymismatchproblem/)
- [`BatchLoaderScopeCollisionProblem`](/api/repository-core/src/classes/batchloaderscopecollisionproblem/)
- [`BatchLoadUnexpectedResultKeyProblem`](/api/repository-core/src/classes/batchloadunexpectedresultkeyproblem/)
- [`BatchLoadUnkeyedResultProblem`](/api/repository-core/src/classes/batchloadunkeyedresultproblem/)
- [`CircuitBreakerOpenProblem`](/api/retry-core/src/classes/circuitbreakeropenproblem/)
- [`DuplicateRecoverHandlerProblem`](/api/retry-core/src/classes/duplicaterecoverhandlerproblem/)
- [`InvalidRetryConfigurationProblem`](/api/retry-core/src/classes/invalidretryconfigurationproblem/)
- [`LambdaTimeoutProblem`](/api/retry-core/src/classes/lambdatimeoutproblem/)
- [`RetryAbortedProblem`](/api/retry-core/src/classes/retryabortedproblem/)
- [`RetryCancellationUnsupportedProblem`](/api/retry-core/src/classes/retrycancellationunsupportedproblem/)
- [`RetryExhaustedProblem`](/api/retry-core/src/classes/retryexhaustedproblem/)
- [`RetrySuccessHookProblem`](/api/retry-core/src/classes/retrysuccesshookproblem/)
- [`CircuitBreakerUnexpectedStateProblem`](/api/retry-core/src/classes/circuitbreakerunexpectedstateproblem/)
- [`IndexNotFoundProblem`](/api/search-core/src/classes/indexnotfoundproblem/)
- [`MissingTenantProblem`](/api/search-core/src/classes/missingtenantproblem/)
- [`SearchCapabilityUnavailableProblem`](/api/search-core/src/classes/searchcapabilityunavailableproblem/)
- [`SearchOperationAbortedProblem`](/api/search-core/src/classes/searchoperationabortedproblem/)
- [`SearchTransformRegistrationConflictProblem`](/api/search-core/src/classes/searchtransformregistrationconflictproblem/)
- [`SearchableIndexConflictProblem`](/api/search-core/src/classes/searchableindexconflictproblem/)
- [`SearchSyncIdentityConflictProblem`](/api/search-core/src/classes/searchsyncidentityconflictproblem/)
- [`StrategyUnavailableProblem`](/api/search-core/src/classes/strategyunavailableproblem/)
- [`TransformNotFoundProblem`](/api/search-core/src/classes/transformnotfoundproblem/)
- [`MeilisearchIndexNotFoundProblem`](/api/search-meilisearch/src/classes/meilisearchindexnotfoundproblem/)
- [`MeilisearchInvalidRequestProblem`](/api/search-meilisearch/src/classes/meilisearchinvalidrequestproblem/)
- [`MeilisearchRetryableUpstreamProblem`](/api/search-meilisearch/src/classes/meilisearchretryableupstreamproblem/)
- [`MeilisearchTaskCanceledProblem`](/api/search-meilisearch/src/classes/meilisearchtaskcanceledproblem/)
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
- [`TelemetryBatchConfigurationProblem`](/api/telemetry-sdk-node/src/classes/telemetrybatchconfigurationproblem/)
- [`TelemetryForceFlushUnsupportedProblem`](/api/telemetry-sdk-node/src/classes/telemetryforceflushunsupportedproblem/)
- [`TelemetryInitializationConflictProblem`](/api/telemetry-sdk-node/src/classes/telemetryinitializationconflictproblem/)
- [`TelemetryShutdownTimeoutInvalidProblem`](/api/telemetry-sdk-node/src/classes/telemetryshutdowntimeoutinvalidproblem/)
- [`TelemetryShutdownTimeoutProblem`](/api/telemetry-sdk-node/src/classes/telemetryshutdowntimeoutproblem/)
- [`TelemetryAutoInstrumentationProblem`](/api/telemetry-sdk-node/src/classes/telemetryautoinstrumentationproblem/)
- [`TestEvidenceContractError`](/api/testing/src/classes/testevidencecontracterror/)
- [`TestEvidenceFidelityError`](/api/testing/src/classes/testevidencefidelityerror/)
- [`ChangedTestPlanProblem`](/api/testing/src/classes/changedtestplanproblem/)
- [`ExecutableAssuranceContractProblem`](/api/testing/src/classes/executableassurancecontractproblem/)
- [`ExecutableAssuranceUnsatisfiedProblem`](/api/testing/src/classes/executableassuranceunsatisfiedproblem/)
- [`ContractInvariantProblem`](/api/testing/src/classes/contractinvariantproblem/)
- [`ContractRuntimeMismatchProblem`](/api/testing/src/classes/contractruntimemismatchproblem/)
- [`ContractTestingProblem`](/api/testing/src/classes/contracttestingproblem/)
- [`UnsupportedContractGenerationProblem`](/api/testing/src/classes/unsupportedcontractgenerationproblem/)
- [`TestKernelDisposedProblem`](/api/testing/src/classes/testkerneldisposedproblem/)
- [`TestKernelDisposalProblem`](/api/testing/src/classes/testkerneldisposalproblem/)
- [`TestKernelLeakProblem`](/api/testing/src/classes/testkernelleakproblem/)
- [`TestKernelResourceFidelityProblem`](/api/testing/src/classes/testkernelresourcefidelityproblem/)
- [`TestKernelResourceNotFoundProblem`](/api/testing/src/classes/testkernelresourcenotfoundproblem/)
- [`TestKernelResourceRegistrationProblem`](/api/testing/src/classes/testkernelresourceregistrationproblem/)
- [`TestKernelValidationProblem`](/api/testing/src/classes/testkernelvalidationproblem/)
- [`TestRuntimeDrainProblem`](/api/testing/src/classes/testruntimedrainproblem/)
- [`TestKernelOutboundCallProblem`](/api/testing/src/classes/testkerneloutboundcallproblem/)
- [`TestRuntimeConfigurationProblem`](/api/testing/src/classes/testruntimeconfigurationproblem/)
- [`ScenarioContractProblem`](/api/testing/src/classes/scenariocontractproblem/)
- [`TestResourceConfigurationProblem`](/api/testing-resources/src/classes/testresourceconfigurationproblem/)
- [`TestResourceLifecycleProblem`](/api/testing-resources/src/classes/testresourcelifecycleproblem/)
- [`DuplicateTaskRegistrationProblem`](/api/tasks-core/src/classes/duplicatetaskregistrationproblem/)
- [`InvalidTaskReferenceProblem`](/api/tasks-core/src/classes/invalidtaskreferenceproblem/)
- [`TaskExecutionTimeoutProblem`](/api/tasks-core/src/classes/taskexecutiontimeoutproblem/)
- [`TaskNotFoundProblem`](/api/tasks-core/src/classes/tasknotfoundproblem/)
- [`TaskRunnerDIFailureProblem`](/api/tasks-core/src/classes/taskrunnerdifailureproblem/)
- [`QStashTaskConfigProblem`](/api/tasks-qstash/src/classes/qstashtaskconfigproblem/)
- [`QStashTaskPublishProblem`](/api/tasks-qstash/src/classes/qstashtaskpublishproblem/)
- [`QStashTaskValidationProblem`](/api/tasks-qstash/src/classes/qstashtaskvalidationproblem/)
- [`DuplicateTenantManagerRegistrationProblem`](/api/tenant-core/src/classes/duplicatetenantmanagerregistrationproblem/)
- [`TenantManagerNotRegisteredProblem`](/api/tenant-core/src/classes/tenantmanagernotregisteredproblem/)
- [`TenantNotFoundProblem`](/api/tenant-core/src/classes/tenantnotfoundproblem/)
- [`TenantRequiredProblem`](/api/tenant-core/src/classes/tenantrequiredproblem/)
- [`GraphQLBodyLimitConfigurationProblem`](/api/transports-graphql/src/classes/graphqlbodylimitconfigurationproblem/)
- [`GraphQLRequestBodyAbortedProblem`](/api/transports-graphql/src/classes/graphqlrequestbodyabortedproblem/)
- [`GraphQLRequestBodyTooLargeProblem`](/api/transports-graphql/src/classes/graphqlrequestbodytoolargeproblem/)
- [`GraphQLRequestHandlingFailedProblem`](/api/transports-graphql/src/classes/graphqlrequesthandlingfailedproblem/)
- [`GraphQLResolversNotConfiguredProblem`](/api/transports-graphql/src/classes/graphqlresolversnotconfiguredproblem/)
- [`GraphQLSchemaNotConfiguredProblem`](/api/transports-graphql/src/classes/graphqlschemanotconfiguredproblem/)
- [`GraphQLServerNotInitializedProblem`](/api/transports-graphql/src/classes/graphqlservernotinitializedproblem/)
- [`DiagnosticsConfigurationProblem`](/api/transports-http/src/classes/diagnosticsconfigurationproblem/)
- [`HttpBodyLimitConfigurationProblem`](/api/transports-http/src/classes/httpbodylimitconfigurationproblem/)
- [`HttpRequestBodyReadProblem`](/api/transports-http/src/classes/httprequestbodyreadproblem/)
- [`HttpRequestBodyTooLargeProblem`](/api/transports-http/src/classes/httprequestbodytoolargeproblem/)
- [`HttpRequestBodyUnavailableProblem`](/api/transports-http/src/classes/httprequestbodyunavailableproblem/)
- [`GracefulShutdownConfigurationProblem`](/api/transports-http/src/classes/gracefulshutdownconfigurationproblem/)
- [`GracefulShutdownTimeoutProblem`](/api/transports-http/src/classes/gracefulshutdowntimeoutproblem/)
- [`DuplicateTxManagerRegistrationProblem`](/api/tx-core/src/classes/duplicatetxmanagerregistrationproblem/)
- [`TxManagerNotRegisteredError`](/api/tx-core/src/classes/txmanagernotregisterederror/)
- [`TxPropagationError`](/api/tx-core/src/classes/txpropagationerror/)
- [`AfterCommitOutcomeRequiredProblem`](/api/tx-core/src/classes/aftercommitoutcomerequiredproblem/)
- [`AfterCommitRegistrationClosedProblem`](/api/tx-core/src/classes/aftercommitregistrationclosedproblem/)
- [`AfterCommitHooksProblem`](/api/tx-core/src/classes/aftercommithooksproblem/)
- [`DetachedTransactionOperationProblem`](/api/tx-core/src/classes/detachedtransactionoperationproblem/)
- [`InvalidTransactionTimeoutProblem`](/api/tx-core/src/classes/invalidtransactiontimeoutproblem/)
- [`TransactionContextProblem`](/api/tx-core/src/classes/transactioncontextproblem/)
- [`TransactionDecoratorProblem`](/api/tx-core/src/classes/transactiondecoratorproblem/)
- [`TransactionOutcomeContextProblem`](/api/tx-core/src/classes/transactionoutcomecontextproblem/)
- [`TransactionOutcomeUnknownProblem`](/api/tx-core/src/classes/transactionoutcomeunknownproblem/)
- [`TransactionRollbackConfirmedProblem`](/api/tx-core/src/classes/transactionrollbackconfirmedproblem/)
- [`TransactionTimeoutProblem`](/api/tx-core/src/classes/transactiontimeoutproblem/)
- [`RlsConfigurationProblem`](/api/tx-drizzle/src/classes/rlsconfigurationproblem/)
- [`RlsDebugLoggingProblem`](/api/tx-drizzle/src/classes/rlsdebugloggingproblem/)
- [`RlsExecuteUnsupportedProblem`](/api/tx-drizzle/src/classes/rlsexecuteunsupportedproblem/)
- [`SavepointUnsupportedProblem`](/api/tx-drizzle/src/classes/savepointunsupportedproblem/)
- [`TenantContextRequiredProblem`](/api/tx-drizzle/src/classes/tenantcontextrequiredproblem/)
- [`DuplicateWorkflowRegistrationProblem`](/api/workflow-core/src/classes/duplicateworkflowregistrationproblem/)
- [`SagaDefinitionProblem`](/api/workflow-core/src/classes/sagadefinitionproblem/)
- [`SagaExecutionFailedProblem`](/api/workflow-core/src/classes/sagaexecutionfailedproblem/)
- [`SagaExecutionNotFoundProblem`](/api/workflow-core/src/classes/sagaexecutionnotfoundproblem/)
- [`SagaFinalizationProblem`](/api/workflow-core/src/classes/sagafinalizationproblem/)
- [`SagaListPaginationProblem`](/api/workflow-core/src/classes/sagalistpaginationproblem/)
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
