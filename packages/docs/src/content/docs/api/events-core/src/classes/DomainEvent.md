---
editUrl: false
next: false
prev: false
title: "DomainEvent"
---

모든 도메인 이벤트가 상속해야 하는 기본 추상 클래스입니다.

## Extended by

- [`DocumentIndexedEvent`](/api/search-core/src/classes/documentindexedevent/)
- [`DocumentDeletedEvent`](/api/search-core/src/classes/documentdeletedevent/)
- [`SearchSyncFailedEvent`](/api/search-core/src/classes/searchsyncfailedevent/)
- [`OrderPaidEvent`](/api/billing-core/src/classes/orderpaidevent/)
- [`PlanChangedEvent`](/api/billing-core/src/classes/planchangedevent/)
- [`SubscriptionActivatedEvent`](/api/billing-core/src/classes/subscriptionactivatedevent/)
- [`SubscriptionCanceledEvent`](/api/billing-core/src/classes/subscriptioncanceledevent/)
- [`SubscriptionPastDueEvent`](/api/billing-core/src/classes/subscriptionpastdueevent/)
- [`SubscriptionRevokedEvent`](/api/billing-core/src/classes/subscriptionrevokedevent/)
- [`DomainAutoJoinedEvent`](/api/invitation-core/src/classes/domainautojoinedevent/)
- [`DomainPolicyAddedEvent`](/api/invitation-core/src/classes/domainpolicyaddedevent/)
- [`DomainPolicyRemovedEvent`](/api/invitation-core/src/classes/domainpolicyremovedevent/)
- [`InvitationAcceptedEvent`](/api/invitation-core/src/classes/invitationacceptedevent/)
- [`InvitationCreatedEvent`](/api/invitation-core/src/classes/invitationcreatedevent/)
- [`InvitationDeclinedEvent`](/api/invitation-core/src/classes/invitationdeclinedevent/)
- [`InvitationRevokedEvent`](/api/invitation-core/src/classes/invitationrevokedevent/)
- [`LlmGeneratedEvent`](/api/llm-core/src/classes/llmgeneratedevent/)
- [`LlmStreamCompletedEvent`](/api/llm-core/src/classes/llmstreamcompletedevent/)
- [`LlmToolCalledEvent`](/api/llm-core/src/classes/llmtoolcalledevent/)
- [`LlmUsageRecordedEvent`](/api/llm-core/src/classes/llmusagerecordedevent/)
- [`LlmCostBudgetExceededEvent`](/api/llm-metering/src/classes/llmcostbudgetexceededevent/)
- [`LlmUsageRecordedEvent`](/api/llm-metering/src/classes/llmusagerecordedevent/)
- [`MembershipCreatedEvent`](/api/membership-core/src/classes/membershipcreatedevent/)
- [`MembershipRemovedEvent`](/api/membership-core/src/classes/membershipremovedevent/)
- [`MembershipUpdatedEvent`](/api/membership-core/src/classes/membershipupdatedevent/)
- [`QuotaExceededEvent`](/api/metering-core/src/classes/quotaexceededevent/)
- [`UsageRecordedEvent`](/api/metering-core/src/classes/usagerecordedevent/)

## Constructors

### Constructor

> **new DomainEvent**(): `DomainEvent`

#### Returns

`DomainEvent`

## Properties

### eventId

> `readonly` **eventId**: `string`

***

### eventName

> `readonly` **eventName**: `string`

***

### metadata

> **metadata**: [`DomainEventMetadata`](/api/events-core/src/type-aliases/domaineventmetadata/)

***

### timestamp

> `readonly` **timestamp**: `Date`

***

### eventName?

> `static` `optional` **eventName**: `string`
