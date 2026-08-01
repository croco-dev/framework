import { z } from "zod";
import {
  defineMessage,
  type MessageContext,
  type MessageData,
  type MessageRenderer,
  Renders,
} from "../index";

const TrialEnding = defineMessage({
  id: "billing.trial-ending",
  topic: "billing",
  data: z.object({ firstName: z.string(), upgradeUrl: z.string().url() }).strict(),
  channels: ["email", "push"],
});

@Renders(TrialEnding)
class TrialEndingRenderer implements MessageRenderer<typeof TrialEnding> {
  email({ data }: MessageContext<typeof TrialEnding>) {
    return { subject: data.firstName, html: data.firstName, text: data.firstName };
  }

  push({ data }: MessageContext<typeof TrialEnding>) {
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
