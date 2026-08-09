# @croco/notifications-react-email

Optional React Email rendering for the canonical `EmailContent` contract from `@croco/engagement-core`.

```tsx
import {
  defineMessage,
  type MessageContext,
  type MessageRenderer,
  Renders,
} from "@croco/engagement-core";
import { reactEmail } from "@croco/notifications-react-email";
import { z } from "zod";

const TrialEnding = defineMessage({
  id: "billing.trial-ending",
  topic: "billing",
  data: z.object({ firstName: z.string(), tenantName: z.string() }),
  channels: ["email"],
});

@Renders(TrialEnding)
class TrialEndingRenderer implements MessageRenderer<typeof TrialEnding> {
  email({ data }: MessageContext<typeof TrialEnding, "email">) {
    return reactEmail({
      subject: `${data.tenantName}'s trial is ending`,
      preview: "Review your plan.",
      body: <TrialEndingEmail {...data} />,
      text: `${data.firstName}, your trial is ending.`,
      replyTo: "support@example.com",
      headers: { "X-Message-Kind": "trial-ending" },
    });
  }
}
```

`reactEmail()` is asynchronous and returns the same `EmailContent` shape as a string renderer. When `text` is omitted, it uses the official `@react-email/render` `toPlainText()` helper. `renderReactEmail()` is available for deterministic preview and fixture rendering.

Rendering failures throw `ReactEmailRenderProblem`. The Problem identifies whether HTML or plain-text rendering failed without including component props or rendered content.

Install `react`, `react-dom`, and `@react-email/render` alongside this optional package. Applications that do not install `@croco/notifications-react-email` do not acquire these dependencies through Croco core or provider packages.
