import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  defineMessage,
  getMessageRendererBinding,
  MessageAlreadyRegisteredProblem,
  MessageDataInvalidProblem,
  MessageRendererAlreadyRegisteredProblem,
  MessageRendererBindingMismatchProblem,
  MessageRendererChannelMissingProblem,
  MessageRendererMessageMissingProblem,
  MessageRendererMissingProblem,
  MessageRendererRegistry,
  MessageRendererUndeclaredChannelProblem,
  Renders,
  type MessageRenderer,
} from "../index";

const TrialEnding = defineMessage({
  id: "billing.trial-ending",
  topic: "billing",
  data: z.object({ tenantName: z.string(), upgradeUrl: z.string().url() }).strict(),
  channels: ["email", "push"],
});

describe("MessageContracts", () => {
  it("preserves literals and exposes an inspectable descriptor", () => {
    expect(TrialEnding.descriptor).toMatchObject({
      id: "billing.trial-ending",
      topic: "billing",
      channels: ["email", "push"],
      dataSchema: { kind: "object" },
    });
  });

  it("records renderer bindings without registering a global service or constructing the class", () => {
    let constructions = 0;

    @Renders(TrialEnding)
    class TrialEndingRenderer implements MessageRenderer<typeof TrialEnding> {
      constructor() {
        constructions += 1;
      }

      email({ data }: { readonly data: { readonly tenantName: string } }) {
        return { subject: data.tenantName, html: data.tenantName, text: data.tenantName };
      }

      push({ data }: { readonly data: { readonly tenantName: string } }) {
        return { title: data.tenantName, body: data.tenantName };
      }
    }

    const registry = new MessageRendererRegistry();
    registry.registerRenderer(TrialEndingRenderer);
    registry.registerMessage(TrialEnding);
    registry.bootstrap();

    expect(constructions).toBe(0);
    expect(getMessageRendererBinding(TrialEndingRenderer)).toMatchObject({
      message: { id: "billing.trial-ending" },
      rendererName: "TrialEndingRenderer",
    });
  });

  it("allows messages and renderers to be registered in either declaration order", () => {
    @Renders(TrialEnding)
    class TrialEndingRenderer implements MessageRenderer<typeof TrialEnding> {
      email() {
        return { subject: "Trial", html: "<p>Trial</p>", text: "Trial" };
      }

      push() {
        return { title: "Trial", body: "Trial" };
      }
    }

    const first = new MessageRendererRegistry();
    first.registerMessage(TrialEnding);
    first.registerRenderer(TrialEndingRenderer);
    first.bootstrap();

    const second = new MessageRendererRegistry();
    second.registerRenderer(TrialEndingRenderer);
    second.registerMessage(TrialEnding);
    second.bootstrap();

    expect(second.inspect()).toEqual(first.inspect());
  });

  it("parses untrusted data before a renderer consumes it", () => {
    let rendered = false;
    @Renders(TrialEnding)
    class TrialEndingRenderer implements MessageRenderer<typeof TrialEnding> {
      private readonly prefix = "trial: ";

      email({ data }: { readonly data: { readonly tenantName: string } }) {
        rendered = true;
        return {
          subject: `${this.prefix}${data.tenantName}`,
          html: data.tenantName,
          text: data.tenantName,
        };
      }

      push({ data }: { readonly data: { readonly tenantName: string } }) {
        rendered = true;
        return { title: data.tenantName, body: data.tenantName };
      }
    }
    const registry = new MessageRendererRegistry();
    registry.registerMessage(TrialEnding);
    registry.registerRenderer(TrialEndingRenderer);
    registry.bootstrap();

    expect(
      registry.parseData(TrialEnding, { tenantName: "Acme", upgradeUrl: "https://croco.dev" }),
    ).toEqual({
      tenantName: "Acme",
      upgradeUrl: "https://croco.dev",
    });
    expect(() => registry.parseData(TrialEnding, { tenantName: "Acme", extra: true })).toThrow(
      MessageDataInvalidProblem,
    );
    expect(() =>
      registry.render(TrialEnding, new TrialEndingRenderer(), "email", { tenantName: "Acme" }),
    ).toThrow(MessageDataInvalidProblem);
    expect(rendered).toBe(false);
    expect(
      registry.render(TrialEnding, new TrialEndingRenderer(), "email", {
        tenantName: "Acme",
        upgradeUrl: "https://croco.dev",
      }),
    ).toEqual({ subject: "trial: Acme", html: "Acme", text: "Acme" });
    expect(rendered).toBe(true);
  });

  it("rejects duplicate message IDs and renderer bindings with stable Problems", () => {
    const registry = new MessageRendererRegistry();
    registry.registerMessage(TrialEnding);
    expect(() => registry.registerMessage(TrialEnding)).toThrow(MessageAlreadyRegisteredProblem);

    @Renders(TrialEnding)
    class FirstRenderer implements MessageRenderer<typeof TrialEnding> {
      email() {
        return { subject: "Trial", html: "<p>Trial</p>", text: "Trial" };
      }
      push() {
        return { title: "Trial", body: "Trial" };
      }
    }
    @Renders(TrialEnding)
    class SecondRenderer implements MessageRenderer<typeof TrialEnding> {
      email() {
        return { subject: "Trial", html: "<p>Trial</p>", text: "Trial" };
      }
      push() {
        return { title: "Trial", body: "Trial" };
      }
    }

    registry.registerRenderer(FirstRenderer);
    expect(() => registry.registerRenderer(SecondRenderer)).toThrow(
      MessageRendererAlreadyRegisteredProblem,
    );
  });

  it("fails bootstrap for missing message, renderer, declared channel, and undeclared channel bindings", () => {
    const unbound = new MessageRendererRegistry();
    unbound.registerMessage(TrialEnding);
    expect(() => unbound.bootstrap()).toThrow(MessageRendererMissingProblem);

    class NoBindingRenderer {}
    const noBinding = new MessageRendererRegistry();
    expect(() => noBinding.registerRenderer(NoBindingRenderer)).toThrow(
      MessageRendererMessageMissingProblem,
    );

    @Renders(TrialEnding)
    class MissingPushRenderer {
      email() {
        return { subject: "Trial", html: "<p>Trial</p>", text: "Trial" };
      }
    }
    const missingChannel = new MessageRendererRegistry();
    missingChannel.registerMessages([TrialEnding]);
    missingChannel.registerRenderer(MissingPushRenderer);
    expect(() => missingChannel.bootstrap()).toThrow(MessageRendererChannelMissingProblem);

    const EmailOnly = defineMessage({
      id: "billing.email-only",
      topic: "billing",
      data: z.object({}),
      channels: ["email"],
    });
    @Renders(EmailOnly)
    class ExtraPushRenderer {
      email() {
        return { subject: "Email", html: "<p>Email</p>", text: "Email" };
      }
      push() {
        return { title: "Push", body: "Push" };
      }
    }
    const undeclaredChannel = new MessageRendererRegistry();
    undeclaredChannel.registerMessages([EmailOnly]);
    undeclaredChannel.registerRenderer(ExtraPushRenderer);
    expect(() => undeclaredChannel.bootstrap()).toThrow(MessageRendererUndeclaredChannelProblem);
  });

  it("rejects a renderer bound to a different message definition with the same ID", () => {
    const replacement = defineMessage({
      id: TrialEnding.id,
      topic: "billing-replacement",
      data: z.object({ replacement: z.string() }),
      channels: ["email"],
    });
    @Renders(replacement)
    class ReplacementRenderer implements MessageRenderer<typeof replacement> {
      email({ data }: { readonly data: { readonly replacement: string } }) {
        return { subject: data.replacement, html: data.replacement, text: data.replacement };
      }
    }

    const registry = new MessageRendererRegistry();
    registry.registerMessage(TrialEnding);
    registry.registerRenderer(ReplacementRenderer);
    expect(() => registry.bootstrap()).toThrow(MessageRendererBindingMismatchProblem);
  });
});
