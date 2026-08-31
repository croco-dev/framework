import { z } from "zod";
import {
  defineMessage,
  type EngagementService,
  type MessageContext,
  type MessageData,
  type MessageDataInput,
  type MessageRenderer,
  type MessageRendererRegistry,
  Renders,
} from "../index";

const TrialEnding = defineMessage({
  id: "billing.trial-ending",
  topic: "billing",
  data: z.object({ firstName: z.string(), upgradeUrl: z.string().url() }).strict(),
  channels: ["email", "push"],
});

const TRANSFORMED_MESSAGE = defineMessage({
  id: "billing.transformed",
  topic: "billing",
  data: z.object({ tenantName: z.string().transform((value) => value.length) }).strict(),
  channels: ["email"],
});

@Renders(TrialEnding)
class TrialEndingRenderer implements MessageRenderer<typeof TrialEnding> {
  email({ channel, data }: MessageContext<typeof TrialEnding, "email">) {
    const emailChannel: "email" = channel;
    void emailChannel;
    return { subject: data.firstName, html: data.firstName, text: data.firstName };
  }

  push({ channel, data }: MessageContext<typeof TrialEnding, "push">) {
    const pushChannel: "push" = channel;
    void pushChannel;
    return { title: data.firstName, body: data.firstName, deepLink: data.upgradeUrl };
  }
}

void TrialEndingRenderer;

// @ts-expect-error channel literals must remain first-party fixed contracts
defineMessage({ id: "invalid", topic: "billing", data: z.object({}), channels: ["slack"] });

// @ts-expect-error every declared channel requires a renderer method
class MissingChannelRenderer implements MessageRenderer<typeof TrialEnding> {
  email({ data }: MessageContext<typeof TrialEnding>) {
    return { subject: data.firstName, html: data.firstName, text: data.firstName };
  }
}

void MissingChannelRenderer;

class UndeclaredChannelRenderer implements MessageRenderer<typeof TrialEnding> {
  email({ data }: MessageContext<typeof TrialEnding>) {
    return { subject: data.firstName, html: data.firstName, text: data.firstName };
  }

  push({ data }: MessageContext<typeof TrialEnding>) {
    return { title: data.firstName, body: data.firstName };
  }

  // @ts-expect-error an email/push message cannot implement an SMS renderer
  sms({ data }: MessageContext<typeof TrialEnding>) {
    return { body: data.firstName };
  }
}

void UndeclaredChannelRenderer;

class InvalidContentRenderer implements MessageRenderer<typeof TrialEnding> {
  // @ts-expect-error email requires subject, html, and text rather than push content
  email({ data }: MessageContext<typeof TrialEnding>) {
    return { title: data.firstName, body: data.firstName };
  }

  push({ data }: MessageContext<typeof TrialEnding>) {
    return { title: data.firstName, body: data.firstName };
  }
}

void InvalidContentRenderer;

const requiredData: MessageData<typeof TrialEnding> = {
  firstName: "Ada",
  upgradeUrl: "https://croco.dev/upgrade",
};
void requiredData;

// @ts-expect-error required message data remains required
const missingData: MessageData<typeof TrialEnding> = { upgradeUrl: "https://croco.dev" };
void missingData;

const extraData: MessageData<typeof TrialEnding> = {
  firstName: "Ada",
  upgradeUrl: "https://croco.dev/upgrade",
  // @ts-expect-error strict schemas reject excess message data in typed call sites
  extra: true,
};
void extraData;

const invalidData: MessageData<typeof TrialEnding> = {
  // @ts-expect-error message data fields retain their schema types
  firstName: 1,
  upgradeUrl: "https://croco.dev/upgrade",
};
void invalidData;

const TRANSFORMED_INPUT: MessageDataInput<typeof TRANSFORMED_MESSAGE> = { tenantName: "Croco" };
const TRANSFORMED_OUTPUT: MessageData<typeof TRANSFORMED_MESSAGE> = { tenantName: 5 };
void TRANSFORMED_INPUT;
void TRANSFORMED_OUTPUT;

declare const engagement: EngagementService;

declare const registry: MessageRendererRegistry;
// @ts-expect-error parsed rendering is an internal implementation path
void registry.renderParsed;

engagement.send(TrialEnding, {
  recipient: { tenantId: "tenant-1", userId: "user-1" },
  data: requiredData,
  key: "subscription-1",
});

engagement.send(TRANSFORMED_MESSAGE, {
  recipient: { tenantId: "tenant-1", userId: "user-1" },
  data: TRANSFORMED_INPUT,
  key: "transformed-1",
});

engagement.send(TRANSFORMED_MESSAGE, {
  recipient: { tenantId: "tenant-1", userId: "user-1" },
  // @ts-expect-error send accepts the schema input rather than its transformed output
  data: TRANSFORMED_OUTPUT,
  key: "transformed-1",
});

engagement.send(TrialEnding, {
  recipient: { tenantId: "tenant-1", userId: "user-1" },
  // @ts-expect-error send infers the exact message data contract
  data: { firstName: "Ada" },
  key: "subscription-1",
});

engagement.send(TrialEnding, {
  recipient: { tenantId: "tenant-1", userId: "user-1" },
  data: requiredData,
  key: "subscription-1",
  // @ts-expect-error provider endpoints are resolved behind EngagementService
  to: "user@example.com",
});

engagement.send(TrialEnding, {
  recipient: { tenantId: "tenant-1", userId: "user-1" },
  data: requiredData,
  key: "subscription-1",
  // @ts-expect-error callers cannot select a message channel
  channel: "email",
});
