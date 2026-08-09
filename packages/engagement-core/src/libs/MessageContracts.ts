import type { ContractSchemaDescriptor } from "@croco/protocols-core";
import { describeZodSchema } from "@croco/protocols-core";
import { Problem, ProblemCategory } from "@croco/problems-core";
import type { z } from "zod";

export const MESSAGE_CHANNELS = Object.freeze(["email", "push", "sms", "inApp"] as const);

export type MessageChannel = (typeof MESSAGE_CHANNELS)[number];

export type MessageContentByChannel = {
  readonly email: {
    readonly subject: string;
    readonly html: string;
    readonly text: string;
  };
  readonly push: {
    readonly title: string;
    readonly body: string;
    readonly deepLink?: string;
  };
  readonly sms: {
    readonly body: string;
  };
  readonly inApp: {
    readonly title: string;
    readonly body: string;
    readonly deepLink?: string;
  };
};

export type MessageContent<TChannel extends MessageChannel> = MessageContentByChannel[TChannel];

export type MessageDefinitionInput<
  TId extends string = string,
  TTopic extends string = string,
  TData extends z.ZodTypeAny = z.ZodTypeAny,
  TChannels extends readonly MessageChannel[] = readonly MessageChannel[],
> = {
  readonly id: TId;
  readonly topic: TTopic;
  readonly data: TData;
  readonly channels: TChannels;
};

export type MessageDescriptor<
  TChannels extends readonly MessageChannel[] = readonly MessageChannel[],
> = {
  readonly id: string;
  readonly topic: string;
  readonly channels: TChannels;
  readonly dataSchema: ContractSchemaDescriptor | null;
};

export type DefinedMessage<
  TId extends string = string,
  TTopic extends string = string,
  TData extends z.ZodTypeAny = z.ZodTypeAny,
  TChannels extends readonly MessageChannel[] = readonly MessageChannel[],
> = Readonly<{
  id: TId;
  topic: TTopic;
  data: TData;
  channels: TChannels;
  descriptor: MessageDescriptor<TChannels>;
}>;

type AnyMessage = DefinedMessage<string, string, z.ZodTypeAny, readonly MessageChannel[]>;

export type MessageData<TMessage extends AnyMessage> = z.infer<TMessage["data"]>;

type MessageChannels<TMessage extends AnyMessage> = TMessage["channels"][number];

export type MessageContext<
  TMessage extends AnyMessage,
  TChannel extends MessageChannels<TMessage> = MessageChannels<TMessage>,
> = Readonly<{
  message: TMessage;
  channel: TChannel;
  data: MessageData<TMessage>;
}>;

type RendererMethod<TMessage extends AnyMessage, TChannel extends MessageChannels<TMessage>> = (
  context: MessageContext<TMessage, TChannel>,
) => MessageContent<TChannel>;

/**
 * A complete renderer for the exact channels declared by a message. The `never` members deliberately make
 * accidental renderer methods for undeclared first-party channels a TypeScript error.
 */
export type MessageRenderer<TMessage extends AnyMessage> = {
  readonly [TChannel in MessageChannels<TMessage>]: RendererMethod<TMessage, TChannel>;
} & {
  readonly [TChannel in Exclude<MessageChannel, MessageChannels<TMessage>>]?: never;
};

export type MessageRendererConstructor = abstract new (...arguments_: never[]) => object;

export type MessageRendererBinding<TMessage extends AnyMessage = AnyMessage> = Readonly<{
  message: TMessage;
  rendererName: string;
}>;

export type MessageRegistryInspection = Readonly<{
  messages: readonly MessageDescriptor[];
  renderers: readonly Readonly<{
    messageId: string;
    rendererName: string;
    channels: readonly MessageChannel[];
  }>[];
}>;

const RENDERER_BINDINGS = new WeakMap<Function, MessageRendererBinding>();

export function defineMessage<
  const TId extends string,
  const TTopic extends string,
  TData extends z.ZodTypeAny,
  const TChannels extends readonly [MessageChannel, ...MessageChannel[]],
>(
  input: MessageDefinitionInput<TId, TTopic, TData, TChannels>,
): DefinedMessage<TId, TTopic, TData, TChannels> {
  assertMessageDefinition(input);
  const channels = Object.freeze([...input.channels]) as unknown as TChannels;
  const descriptor = Object.freeze({
    id: input.id,
    topic: input.topic,
    channels,
    dataSchema: describeZodSchema(input.data),
  }) as MessageDescriptor<TChannels>;

  return Object.freeze({
    id: input.id,
    topic: input.topic,
    data: input.data,
    channels,
    descriptor,
  });
}

/** Records the message-to-class binding without mutating a DI container or constructing the class. */
export function Renders<TMessage extends AnyMessage>(message: TMessage): ClassDecorator {
  return (target: Function) => {
    RENDERER_BINDINGS.set(target, Object.freeze({ message, rendererName: rendererNameOf(target) }));
  };
}

export function getMessageRendererBinding(renderer: Function): MessageRendererBinding | undefined {
  return RENDERER_BINDINGS.get(renderer);
}

export class MessageRendererRegistry {
  private readonly messages = new Map<string, AnyMessage>();
  private readonly renderers = new Map<string, Function>();
  private readonly validatedRenderers = new Map<
    string,
    { readonly message: AnyMessage; readonly renderer: Function }
  >();

  registerMessage<TMessage extends AnyMessage>(message: TMessage): void {
    const existing = this.messages.get(message.id);
    if (existing !== undefined) {
      throw new MessageAlreadyRegisteredProblem(message.id);
    }
    this.messages.set(message.id, message);
    this.validatedRenderers.delete(message.id);
  }

  registerMessages(messages: readonly AnyMessage[]): void {
    for (const message of messages) {
      this.registerMessage(message);
    }
  }

  registerRenderer(renderer: MessageRendererConstructor): void {
    const binding = getMessageRendererBinding(renderer);
    if (binding === undefined) {
      throw new MessageRendererMessageMissingProblem(rendererNameOf(renderer), undefined);
    }
    const existing = this.renderers.get(binding.message.id);
    if (existing !== undefined) {
      throw new MessageRendererAlreadyRegisteredProblem(
        binding.message.id,
        rendererNameOf(existing),
        binding.rendererName,
      );
    }
    this.renderers.set(binding.message.id, renderer);
    this.validatedRenderers.delete(binding.message.id);
  }

  registerRenderers(renderers: readonly MessageRendererConstructor[]): void {
    for (const renderer of renderers) {
      this.registerRenderer(renderer);
    }
  }

  /** Validates all explicit registrations without constructing renderer classes. */
  bootstrap(): void {
    this.validatedRenderers.clear();
    for (const [messageId, message] of sortedEntries(this.messages)) {
      const renderer = this.renderers.get(messageId);
      if (renderer === undefined) {
        throw new MessageRendererMissingProblem(messageId, message.channels);
      }
      this.assertRendererMatchesMessage(renderer, message);
      this.validatedRenderers.set(messageId, { message, renderer });
    }

    for (const [messageId, renderer] of sortedEntries(this.renderers)) {
      if (!this.messages.has(messageId)) {
        throw new MessageRendererMessageMissingProblem(rendererNameOf(renderer), messageId);
      }
    }
  }

  parseData<TMessage extends AnyMessage>(message: TMessage, input: unknown): MessageData<TMessage> {
    const parsed = message.data.safeParse(input);
    if (!parsed.success) {
      throw new MessageDataInvalidProblem(
        message.id,
        parsed.error.issues.map((issue) => `${issue.path.join(".") || "$"}: ${issue.message}`),
      );
    }
    return parsed.data as MessageData<TMessage>;
  }

  /** Parses untrusted data before invoking an explicitly registered renderer instance. */
  render<TMessage extends AnyMessage, TChannel extends MessageChannels<TMessage>>(
    message: TMessage,
    renderer: MessageRenderer<TMessage>,
    channel: TChannel,
    input: unknown,
  ): MessageContent<TChannel> {
    const registered = this.renderers.get(message.id);
    if (registered === undefined || registered !== renderer.constructor) {
      throw new MessageRendererMessageMissingProblem(
        rendererNameOf(renderer.constructor),
        message.id,
      );
    }
    const validated = this.validatedRenderers.get(message.id);
    if (validated?.message !== message || validated.renderer !== registered) {
      this.assertRendererMatchesMessage(registered, message);
      this.validatedRenderers.set(message.id, { message, renderer: registered });
    }
    if (!message.channels.includes(channel)) {
      throw new MessageRendererUndeclaredChannelProblem(
        message.id,
        rendererNameOf(registered),
        channel,
      );
    }
    const render = (renderer as unknown as Record<TChannel, RendererMethod<TMessage, TChannel>>)[
      channel
    ];
    return render.call(renderer, { message, channel, data: this.parseData(message, input) });
  }

  inspect(): MessageRegistryInspection {
    const messages = [...this.messages.values()]
      .map((message) => message.descriptor as MessageDescriptor)
      .sort((left, right) => left.id.localeCompare(right.id));
    const renderers = sortedEntries(this.renderers).map(([messageId, renderer]) => {
      const message = this.messages.get(messageId);
      if (message === undefined) {
        throw new MessageRendererMessageMissingProblem(rendererNameOf(renderer), messageId);
      }
      return {
        messageId,
        rendererName: rendererNameOf(renderer),
        channels: message.channels,
      };
    });
    return Object.freeze({
      messages: Object.freeze(messages),
      renderers: Object.freeze(renderers),
    });
  }

  private assertRendererMatchesMessage(renderer: Function, message: AnyMessage): void {
    const binding = RENDERER_BINDINGS.get(renderer);
    if (binding === undefined) {
      throw new MessageRendererMessageMissingProblem(rendererNameOf(renderer), message.id);
    }
    if (binding.message !== message) {
      throw new MessageRendererBindingMismatchProblem(rendererNameOf(renderer), message.id);
    }

    const prototype = renderer.prototype;
    for (const channel of message.channels) {
      if (typeof prototype?.[channel] !== "function") {
        throw new MessageRendererChannelMissingProblem(
          message.id,
          rendererNameOf(renderer),
          channel,
        );
      }
    }
    for (const channel of MESSAGE_CHANNELS) {
      if (!message.channels.includes(channel) && typeof prototype?.[channel] === "function") {
        throw new MessageRendererUndeclaredChannelProblem(
          message.id,
          rendererNameOf(renderer),
          channel,
        );
      }
    }
  }
}

export class MessageDefinitionInvalidProblem extends Problem {
  constructor(detail: string) {
    super("engagement-core/message-definition-invalid", ProblemCategory.ValidationError, detail, {
      extensions: { retryable: false },
    });
  }
}

export class MessageDataInvalidProblem extends Problem {
  constructor(messageId: string, issues: readonly string[]) {
    super(
      "engagement-core/message-data-invalid",
      ProblemCategory.ValidationError,
      `Message data for ${messageId} is invalid`,
      {
        extensions: { messageId, issues, retryable: false },
      },
    );
  }
}

export class MessageAlreadyRegisteredProblem extends Problem {
  constructor(messageId: string) {
    super(
      "engagement-core/message-already-registered",
      ProblemCategory.Conflict,
      `Message ${messageId} is already registered`,
      {
        extensions: { messageId, retryable: false },
      },
    );
  }
}

export class MessageRendererAlreadyRegisteredProblem extends Problem {
  constructor(messageId: string, existingRendererName: string, rendererName: string) {
    super(
      "engagement-core/renderer-already-registered",
      ProblemCategory.Conflict,
      `Message ${messageId} already has renderer ${existingRendererName}; cannot register ${rendererName}`,
      { extensions: { messageId, existingRendererName, rendererName, retryable: false } },
    );
  }
}

export class MessageRendererMissingProblem extends Problem {
  constructor(messageId: string, channels: readonly MessageChannel[]) {
    super(
      "engagement-core/renderer-missing",
      ProblemCategory.InternalServerError,
      `Message ${messageId} has no registered renderer for channels ${channels.join(", ")}`,
      { extensions: { messageId, channels, retryable: false } },
    );
  }
}

export class MessageRendererMessageMissingProblem extends Problem {
  constructor(rendererName: string, messageId: string | undefined) {
    super(
      "engagement-core/renderer-message-missing",
      ProblemCategory.InternalServerError,
      messageId === undefined
        ? `Renderer ${rendererName} is not decorated with @Renders()`
        : `Renderer ${rendererName} is bound to unregistered message ${messageId}`,
      { extensions: { rendererName, messageId, retryable: false } },
    );
  }
}

export class MessageRendererChannelMissingProblem extends Problem {
  constructor(messageId: string, rendererName: string, channel: MessageChannel) {
    super(
      "engagement-core/renderer-channel-missing",
      ProblemCategory.InternalServerError,
      `Renderer ${rendererName} is missing ${channel} for message ${messageId}`,
      { extensions: { messageId, rendererName, channel, retryable: false } },
    );
  }
}

export class MessageRendererBindingMismatchProblem extends Problem {
  constructor(rendererName: string, messageId: string) {
    super(
      "engagement-core/renderer-binding-mismatch",
      ProblemCategory.ValidationError,
      `Renderer ${rendererName} is bound to a different message definition for ${messageId}`,
      { extensions: { rendererName, messageId, retryable: false } },
    );
  }
}

export class MessageRendererUndeclaredChannelProblem extends Problem {
  constructor(messageId: string, rendererName: string, channel: MessageChannel) {
    super(
      "engagement-core/renderer-channel-undeclared",
      ProblemCategory.ValidationError,
      `Renderer ${rendererName} declares ${channel}, which message ${messageId} does not support`,
      { extensions: { messageId, rendererName, channel, retryable: false } },
    );
  }
}

function assertMessageDefinition(input: MessageDefinitionInput): void {
  if (input.id.length === 0) {
    throw new MessageDefinitionInvalidProblem("Message id must not be empty");
  }
  if (input.topic.length === 0) {
    throw new MessageDefinitionInvalidProblem("Message topic must not be empty");
  }
  if (input.channels.length === 0) {
    throw new MessageDefinitionInvalidProblem("Message channels must not be empty");
  }
  const channels = new Set<MessageChannel>();
  for (const channel of input.channels) {
    if (!MESSAGE_CHANNELS.includes(channel)) {
      throw new MessageDefinitionInvalidProblem(`Unsupported message channel ${String(channel)}`);
    }
    if (channels.has(channel)) {
      throw new MessageDefinitionInvalidProblem(
        `Message channel ${channel} is declared more than once`,
      );
    }
    channels.add(channel);
  }
}

function rendererNameOf(renderer: Function): string {
  return renderer.name || "anonymous renderer";
}

function sortedEntries<TValue>(entries: ReadonlyMap<string, TValue>): readonly [string, TValue][] {
  return [...entries.entries()].sort(([left], [right]) => left.localeCompare(right));
}
