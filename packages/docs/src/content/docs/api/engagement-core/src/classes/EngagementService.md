---
editUrl: false
next: false
prev: false
title: "EngagementService"
---

## Constructors

### Constructor

> **new EngagementService**(`directory`, `renderer`, `notifications`, `suppressions?`, `dispatches?`, `clock?`): `EngagementService`

#### Parameters

##### directory

[`RecipientDirectory`](/api/engagement-core/src/interfaces/recipientdirectory/)

##### renderer

[`EngagementMessageRenderer`](/api/engagement-core/src/interfaces/engagementmessagerenderer/)

##### notifications

[`EngagementNotificationDispatcher`](/api/engagement-core/src/interfaces/engagementnotificationdispatcher/)

##### suppressions?

[`EngagementSuppressionEvaluator`](/api/engagement-core/src/interfaces/engagementsuppressionevaluator/) = `ALLOW_ALL_SUPPRESSIONS`

##### dispatches?

[`EngagementDispatchStore`](/api/engagement-core/src/interfaces/engagementdispatchstore/)

##### clock?

() => `Date`

#### Returns

`EngagementService`

## Methods

### send()

> **send**\<`TMessage`\>(`message`, `command`): `Promise`\<[`EngagementSendResult`](/api/engagement-core/src/type-aliases/engagementsendresult/)\>

#### Type Parameters

##### TMessage

`TMessage` _extends_ `Readonly`\<\{ `channels`: readonly (`"email"` \| `"push"` \| `"sms"` \| `"inApp"`)[]; `data`: `ZodTypeAny`; `descriptor`: [`MessageDescriptor`](/api/engagement-core/src/type-aliases/messagedescriptor/)\<readonly (`"email"` \| `"push"` \| `"sms"` \| `"inApp"`)[]\>; `id`: `string`; `topic`: `string`; \}\>

#### Parameters

##### message

`TMessage`

##### command

[`EngagementSendCommand`](/api/engagement-core/src/type-aliases/engagementsendcommand/)\<`TMessage`\>

#### Returns

`Promise`\<[`EngagementSendResult`](/api/engagement-core/src/type-aliases/engagementsendresult/)\>
