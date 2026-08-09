# @croco/engagement-core

Typed, inspectable message definitions and explicit renderer bindings for Croco engagement features.

```ts
import {
  defineMessage,
  type MessageContext,
  type MessageRenderer,
  Renders,
} from "@croco/engagement-core";
import { z } from "zod";

const TrialEnding = defineMessage({
  id: "billing.trial-ending",
  topic: "billing",
  data: z.object({ tenantName: z.string(), upgradeUrl: z.string().url() }),
  channels: ["email", "push"],
});

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    switch (character) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      default:
        return "&#39;";
    }
  });
}

@Renders(TrialEnding)
class TrialEndingRenderer implements MessageRenderer<typeof TrialEnding> {
  email({ data }: MessageContext<typeof TrialEnding>) {
    return {
      subject: "Trial ending",
      html: `<p>${escapeHtml(data.tenantName)}</p>`,
      text: data.tenantName,
    };
  }

  push({ data }: MessageContext<typeof TrialEnding>) {
    return { title: "Trial ending", body: data.tenantName, deepLink: data.upgradeUrl };
  }
}
```

Register messages and renderer constructors explicitly in `MessageRendererRegistry`, then call `bootstrap()` before rendering. The decorator stores a binding only: it never registers a provider or instantiates a renderer.
