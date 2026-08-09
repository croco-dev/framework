import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  defineMessage,
  getMessageRendererBinding,
  MESSAGE_CHANNELS,
  MessageAlreadyRegisteredProblem,
  MessageDataInvalidProblem,
  MessageDefinitionInvalidProblem,
  MessageRendererAlreadyRegisteredProblem,
  MessageRendererBindingMismatchProblem,
  MessageRendererChannelMissingProblem,
  MessageRendererMessageMissingProblem,
  MessageRendererMissingProblem,
  MessageRendererRegistry,
  MessageRendererUndeclaredChannelProblem,
  Renders,
  type MessageContext,
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

  it("keeps the runtime channel allow-list immutable", () => {
    expect(Object.isFrozen(MESSAGE_CHANNELS)).toBe(true);
    expect(() => (MESSAGE_CHANNELS as unknown as string[]).push("slack")).toThrow(TypeError);
    expect(() =>
      defineMessage({
        id: "billing.custom-channel",
        topic: "billing",
        data: z.object({}),
        channels: ["slack" as never],
      }),
    ).toThrow(MessageDefinitionInvalidProblem);
  });

  it("records renderer bindings without registering a global service or constructing the class", () => {
    let constructions = 0;

    @Renders(TrialEnding)
    class TrialEndingRenderer implements MessageRenderer<typeof TrialEnding> {
      constructor() {
        constructions += 1;
      }

      email({ data }: MessageContext<typeof TrialEnding, "email">) {
        return { subject: data.tenantName, html: data.tenantName, text: data.tenantName };
      }

      push({ data }: MessageContext<typeof TrialEnding, "push">) {
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

    const inspection = first.inspect();
    expect(inspection.messages[0]?.id).toBe("billing.trial-ending");
    expect(inspection.renderers[0]).toMatchObject({
      messageId: "billing.trial-ending",
      channels: ["email", "push"],
    });
    expect(second.inspect()).toEqual(inspection);
  });

  it("parses untrusted data before a renderer consumes it", async () => {
    let rendered = false;
    @Renders(TrialEnding)
    class TrialEndingRenderer implements MessageRenderer<typeof TrialEnding> {
      private readonly prefix = "trial: ";

      email({ data }: MessageContext<typeof TrialEnding, "email">) {
        rendered = true;
        return {
          subject: `${this.prefix}${data.tenantName}`,
          html: data.tenantName,
          text: data.tenantName,
        };
      }

      push({ data }: MessageContext<typeof TrialEnding, "push">) {
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
    try {
      registry.parseData(TrialEnding, { tenantName: "Acme", extra: true });
      expect.unreachable("invalid message data should throw");
    } catch (error) {
      expect(error).toBeInstanceOf(MessageDataInvalidProblem);
      expect(error).toMatchObject({ code: "engagement-core/message-data-invalid" });
    }
    await expect(
      registry.render(TrialEnding, new TrialEndingRenderer(), "email", { tenantName: "Acme" }),
    ).rejects.toThrow(MessageDataInvalidProblem);
    expect(rendered).toBe(false);
    await expect(
      registry.render(TrialEnding, new TrialEndingRenderer(), "email", {
        tenantName: "Acme",
        upgradeUrl: "https://croco.dev",
      }),
    ).resolves.toEqual({ subject: "trial: Acme", html: "Acme", text: "Acme" });
    expect(rendered).toBe(true);

    await expect(
      registry.render(TrialEnding, new TrialEndingRenderer(), "sms" as never, {
        tenantName: "Acme",
        upgradeUrl: "https://croco.dev",
      }),
    ).rejects.toThrow(MessageRendererUndeclaredChannelProblem);
  });

  it("accepts asynchronous channel renderers", async () => {
    @Renders(TrialEnding)
    class AsyncRenderer implements MessageRenderer<typeof TrialEnding> {
      async email({ data }: MessageContext<typeof TrialEnding, "email">) {
        return {
          subject: data.tenantName,
          html: `<p>${data.tenantName}</p>`,
          text: data.tenantName,
        };
      }

      async push({ data }: MessageContext<typeof TrialEnding, "push">) {
        return { title: data.tenantName, body: data.tenantName };
      }
    }

    const registry = new MessageRendererRegistry();
    registry.registerMessage(TrialEnding);
    registry.registerRenderer(AsyncRenderer);
    registry.bootstrap();

    await expect(
      registry.render(TrialEnding, new AsyncRenderer(), "email", {
        tenantName: "Acme",
        upgradeUrl: "https://croco.dev",
      }),
    ).resolves.toEqual({ subject: "Acme", html: "<p>Acme</p>", text: "Acme" });
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

  it("rejects a renderer bound to a different message definition with the same ID", async () => {
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

    @Renders(TrialEnding)
    class TrialEndingRenderer implements MessageRenderer<typeof TrialEnding> {
      email({ data }: MessageContext<typeof TrialEnding, "email">) {
        return { subject: data.tenantName, html: data.tenantName, text: data.tenantName };
      }

      push({ data }: MessageContext<typeof TrialEnding, "push">) {
        return { title: data.tenantName, body: data.tenantName };
      }
    }

    const cached = new MessageRendererRegistry();
    cached.registerMessage(TrialEnding);
    cached.registerRenderer(TrialEndingRenderer);
    cached.bootstrap();
    await expect(
      cached.render(replacement, new TrialEndingRenderer() as never, "email", {
        replacement: "Replacement",
      }),
    ).rejects.toThrow(MessageRendererBindingMismatchProblem);
  });
});
