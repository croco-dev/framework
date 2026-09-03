import { z } from "zod";

import {
  Audience,
  defineCampaign,
  type AudienceContext,
  type AudienceSource,
} from "../libs/CampaignContracts";
import { defineMessage } from "../libs/MessageContracts";

type Member = Readonly<{
  recipient: Readonly<{ tenantId: string; userId: string }>;
  subscriptionId: string;
  firstName: string;
}>;

@Audience("inactive-trials")
class InactiveTrials implements AudienceSource<Member> {
  async *members(_context: AudienceContext): AsyncIterable<Member> {
    yield {
      recipient: { tenantId: "tenant-1", userId: "user-1" },
      subscriptionId: "subscription-1",
      firstName: "Ada",
    };
  }
}

const TrialEnding = defineMessage({
  id: "trial-ending",
  topic: "billing",
  data: z.object({ firstName: z.string(), upgradeUrl: z.string().url() }).strict(),
  channels: ["email"],
});

declare const dynamicVersion: string;

defineCampaign({
  id: "trial-reminder",
  version: "1.0.0",
  audience: InactiveTrials,
  message: TrialEnding,
  map: (member) => ({
    recipient: member.recipient,
    data: { firstName: member.firstName, upgradeUrl: "https://croco.dev/upgrade" },
    key: member.subscriptionId,
  }),
});

defineCampaign({
  id: "missing-data",
  version: "1.0.0",
  audience: InactiveTrials,
  message: TrialEnding,
  map: (member) => ({
    recipient: member.recipient,
    // @ts-expect-error campaign mapper must return every required message data field
    data: { firstName: member.firstName },
    key: member.subscriptionId,
  }),
});

defineCampaign({
  id: "extra-data",
  version: "1.0.0",
  audience: InactiveTrials,
  message: TrialEnding,
  map: (member) => ({
    recipient: member.recipient,
    data: {
      firstName: member.firstName,
      upgradeUrl: "https://croco.dev/upgrade",
      // @ts-expect-error campaign mapper rejects undeclared message data fields
      unexpected: true,
    },
    key: member.subscriptionId,
  }),
});

defineCampaign({
  id: "wrong-data",
  version: "1.0.0",
  audience: InactiveTrials,
  message: TrialEnding,
  map: (member) => ({
    recipient: member.recipient,
    data: {
      // @ts-expect-error campaign mapper preserves message field types
      firstName: 1,
      upgradeUrl: "https://croco.dev/upgrade",
    },
    key: member.subscriptionId,
  }),
});

defineCampaign({
  id: "extra-command-field",
  version: "1.0.0",
  audience: InactiveTrials,
  message: TrialEnding,
  map: (member) => ({
    recipient: member.recipient,
    data: { firstName: member.firstName, upgradeUrl: "https://croco.dev/upgrade" },
    key: member.subscriptionId,
    // @ts-expect-error campaign mapper output is exactly an EngagementSendCommand
    channel: "email",
  }),
});

defineCampaign({
  id: "missing-key",
  version: "1.0.0",
  audience: InactiveTrials,
  message: TrialEnding,
  // @ts-expect-error every campaign member requires a semantic key
  map: (member) => ({
    recipient: member.recipient,
    data: { firstName: member.firstName, upgradeUrl: "https://croco.dev/upgrade" },
  }),
});

defineCampaign({
  id: "wrong-member",
  version: "1.0.0",
  audience: InactiveTrials,
  message: TrialEnding,
  map: (member) => ({
    recipient: member.recipient,
    data: {
      // @ts-expect-error mapper input is inferred from the audience source
      firstName: member.unknownName,
      upgradeUrl: "https://croco.dev/upgrade",
    },
    key: member.subscriptionId,
  }),
});

defineCampaign({
  id: "dynamic-version",
  // @ts-expect-error campaign version must be a stable string literal
  version: dynamicVersion,
  audience: InactiveTrials,
  message: TrialEnding,
  map: (member) => ({
    recipient: member.recipient,
    data: { firstName: member.firstName, upgradeUrl: "https://croco.dev/upgrade" },
    key: member.subscriptionId,
  }),
});

defineCampaign({
  id: "empty-version",
  // @ts-expect-error campaign version must not be the empty string
  version: "",
  audience: InactiveTrials,
  message: TrialEnding,
  map: (member) => ({
    recipient: member.recipient,
    data: { firstName: member.firstName, upgradeUrl: "https://croco.dev/upgrade" },
    key: member.subscriptionId,
  }),
});
