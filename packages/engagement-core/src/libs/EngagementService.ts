import {
  NotificationChannel,
  NotificationPreferenceDeniedProblem,
  type NotificationDispatchResult,
  type NotificationPayload,
  type NotificationSendContractOptions,
} from "@croco/notifications-core";
import { Problem, ProblemCategory } from "@croco/problems-core";
import {
  MessageRendererAlreadyRegisteredProblem,
  MessageRendererMissingProblem,
  type AnyMessage,
  type MessageChannel,
  type MessageContent,
  type MessageData,
  type MessageRenderer,
  type MessageRendererRegistry,
} from "./MessageContracts";

export type RecipientRef = Readonly<{
  tenantId: string;
  userId: string;
}>;

export type EmailEndpoint = Readonly<{
  id: string;
  address: string;
}>;

export type PushEndpoint = Readonly<{
  id: string;
  token: string;
}>;

export type ResolvedRecipient = Readonly<{
  recipient: RecipientRef;
  email?: EmailEndpoint;
  push: readonly PushEndpoint[];
  locale?: string;
  timezone?: string;
}>;

export interface RecipientDirectory {
  resolve(ref: RecipientRef): Promise<ResolvedRecipient | undefined>;
}

export type EngagementDeliveryPolicy = "first-reachable" | "all-reachable";

export type EngagementSendCommand<TMessage extends AnyMessage> = Readonly<{
  recipient: RecipientRef;
  data: MessageData<TMessage>;
  key: string;
  policy?: EngagementDeliveryPolicy;
}>;

export type EngagementChannelResult =
  | Readonly<{
      channel: MessageChannel;
      status: "queued";
      executionIds: readonly string[];
    }>
  | Readonly<{
      channel: MessageChannel;
      status: "suppressed";
      reason: "preference" | "suppression";
    }>
  | Readonly<{
      channel: MessageChannel;
      status: "unavailable";
      reason: "no-endpoint";
    }>
  | Readonly<{
      channel: MessageChannel;
      status: "skipped";
      reason: "policy";
    }>;

export type EngagementSendResult =
  | Readonly<{
      status: "queued";
      executionIds: readonly string[];
      channelResults: readonly EngagementChannelResult[];
    }>
  | Readonly<{
      status: "suppressed";
      reason: "preference" | "suppression" | "no-endpoint";
      channelResults: readonly EngagementChannelResult[];
    }>;

export interface EngagementNotificationDispatcher {
  dispatch(
    channel: NotificationChannel,
    payload: NotificationPayload,
    options: NotificationSendContractOptions,
  ): Promise<NotificationDispatchResult>;
}

export type EngagementSuppressionContext = Readonly<{
  recipient: RecipientRef;
  messageId: string;
  topic: string;
  channel: MessageChannel;
  endpointId: string;
}>;

export type EngagementSuppressionDecision = Readonly<{
  suppressed: boolean;
  reason?: string;
}>;

export interface EngagementSuppressionEvaluator {
  evaluate(context: EngagementSuppressionContext): Promise<EngagementSuppressionDecision>;
}

export interface EngagementMessageRenderer {
  render<TMessage extends AnyMessage, TChannel extends TMessage["channels"][number]>(
    message: TMessage,
    channel: TChannel,
    data: MessageData<TMessage>,
  ): Promise<MessageContent<TChannel>>;
}

export interface MessageRendererResolver {
  resolve<TMessage extends AnyMessage>(message: TMessage): MessageRenderer<TMessage>;
}

export class InMemoryMessageRendererResolver implements MessageRendererResolver {
  private readonly renderers = new Map<string, object>();

  register<TMessage extends AnyMessage>(
    message: TMessage,
    renderer: MessageRenderer<TMessage>,
  ): void {
    const existing = this.renderers.get(message.id);
    if (existing !== undefined) {
      throw new MessageRendererAlreadyRegisteredProblem(
        message.id,
        rendererNameOf(existing),
        rendererNameOf(renderer),
      );
    }
    this.renderers.set(message.id, renderer);
  }

  resolve<TMessage extends AnyMessage>(message: TMessage): MessageRenderer<TMessage> {
    const renderer = this.renderers.get(message.id);
    if (renderer === undefined) {
      throw new MessageRendererMissingProblem(message.id, message.channels);
    }
    return renderer as MessageRenderer<TMessage>;
  }
}

export class RegistryEngagementMessageRenderer implements EngagementMessageRenderer {
  constructor(
    private readonly registry: MessageRendererRegistry,
    private readonly resolver: MessageRendererResolver,
  ) {}

  async render<TMessage extends AnyMessage, TChannel extends TMessage["channels"][number]>(
    message: TMessage,
    channel: TChannel,
    data: MessageData<TMessage>,
  ): Promise<MessageContent<TChannel>> {
    return this.registry.render(message, this.resolver.resolve(message), channel, data);
  }
}

export class InMemoryRecipientDirectory implements RecipientDirectory {
  private readonly recipients = new Map<string, ResolvedRecipient>();

  constructor(recipients: readonly ResolvedRecipient[] = []) {
    for (const recipient of recipients) {
      this.set(recipient);
    }
  }

  set(recipient: ResolvedRecipient): void {
    this.recipients.set(recipientKey(recipient.recipient), snapshotRecipient(recipient));
  }

  delete(ref: RecipientRef): boolean {
    return this.recipients.delete(recipientKey(ref));
  }

  async resolve(ref: RecipientRef): Promise<ResolvedRecipient | undefined> {
    return this.recipients.get(recipientKey(ref));
  }
}

type ResolvedEndpoint = Readonly<{
  id: string;
  target: string;
}>;

export type EngagementIdempotencyKeyInput = Readonly<{
  tenantId: string;
  messageId: string;
  userId: string;
  channel: MessageChannel;
  semanticKey: string;
  endpointId: string;
}>;

const ALLOW_ALL_SUPPRESSIONS: EngagementSuppressionEvaluator = {
  async evaluate() {
    return { suppressed: false };
  },
};

export function createEngagementIdempotencyKey(input: EngagementIdempotencyKeyInput): string {
  return [
    "engagement",
    input.tenantId,
    input.messageId,
    input.userId,
    input.channel,
    input.semanticKey,
    input.endpointId,
  ]
    .map(encodeURIComponent)
    .join(":");
}

export class EngagementService {
  constructor(
    private readonly directory: RecipientDirectory,
    private readonly renderer: EngagementMessageRenderer,
    private readonly notifications: EngagementNotificationDispatcher,
    private readonly suppressions: EngagementSuppressionEvaluator = ALLOW_ALL_SUPPRESSIONS,
  ) {}

  async send<TMessage extends AnyMessage>(
    message: TMessage,
    command: EngagementSendCommand<TMessage>,
  ): Promise<EngagementSendResult> {
    assertCommand(command);
    const recipient = await this.resolveRecipient(command.recipient);
    const policy = command.policy ?? "first-reachable";
    const channelResults: EngagementChannelResult[] = [];
    const executionIds: string[] = [];

    for (const channel of message.channels) {
      const endpoints = endpointsForChannel(recipient, channel);

      if (executionIds.length > 0 && policy === "first-reachable") {
        channelResults.push(
          endpoints.length === 0
            ? { channel, status: "unavailable", reason: "no-endpoint" }
            : { channel, status: "skipped", reason: "policy" },
        );
        continue;
      }

      if (endpoints.length === 0) {
        channelResults.push({ channel, status: "unavailable", reason: "no-endpoint" });
        continue;
      }

      const eligibleEndpoints = await this.filterSuppressedEndpoints(
        message,
        recipient,
        endpoints,
        channel,
      );
      if (eligibleEndpoints.length === 0) {
        channelResults.push({ channel, status: "suppressed", reason: "suppression" });
        continue;
      }

      const content = await this.render(message, command, channel);
      const channelExecutionIds: string[] = [];

      for (const endpoint of eligibleEndpoints) {
        try {
          const result = await this.notifications.dispatch(
            toNotificationChannel(channel),
            toNotificationPayload(message, recipient, channel, endpoint, content),
            {
              idempotencyKey: createEngagementIdempotencyKey({
                tenantId: command.recipient.tenantId,
                messageId: message.id,
                userId: command.recipient.userId,
                channel,
                semanticKey: command.key,
                endpointId: endpoint.id,
              }),
              preferenceContext: {
                tenantId: command.recipient.tenantId,
                userId: command.recipient.userId,
                channel: toNotificationChannel(channel),
                topic: message.topic,
              },
            },
          );
          channelExecutionIds.push(result.executionId);
          executionIds.push(result.executionId);
        } catch (error) {
          if (error instanceof NotificationPreferenceDeniedProblem) {
            if (channelExecutionIds.length === 0) {
              channelResults.push({ channel, status: "suppressed", reason: "preference" });
            }
            break;
          }
          throw new EngagementDispatchFailedProblem(
            message.id,
            command.recipient,
            channel,
            [
              ...channelResults,
              ...(channelExecutionIds.length === 0
                ? []
                : [{ channel, status: "queued" as const, executionIds: channelExecutionIds }]),
            ],
            normalizeError(error),
          );
        }
      }

      if (channelExecutionIds.length > 0) {
        channelResults.push({ channel, status: "queued", executionIds: channelExecutionIds });
      }
    }

    if (executionIds.length > 0) {
      return freezeResult({ status: "queued", executionIds, channelResults });
    }

    return freezeResult({
      status: "suppressed",
      reason: suppressionReason(channelResults),
      channelResults,
    });
  }

  private async resolveRecipient(ref: RecipientRef): Promise<ResolvedRecipient> {
    let recipient: ResolvedRecipient | undefined;
    try {
      recipient = await this.directory.resolve(ref);
    } catch (error) {
      throw new RecipientDirectoryLookupProblem(ref, normalizeError(error));
    }
    if (recipient === undefined) {
      throw new RecipientNotFoundProblem(ref);
    }
    if (
      recipient.recipient.tenantId !== ref.tenantId ||
      recipient.recipient.userId !== ref.userId
    ) {
      throw new RecipientDirectoryScopeMismatchProblem(ref);
    }
    return recipient;
  }

  private async filterSuppressedEndpoints<TMessage extends AnyMessage>(
    message: TMessage,
    recipient: ResolvedRecipient,
    endpoints: readonly ResolvedEndpoint[],
    channel: TMessage["channels"][number],
  ): Promise<readonly ResolvedEndpoint[]> {
    const eligible: ResolvedEndpoint[] = [];
    for (const endpoint of endpoints) {
      let decision: EngagementSuppressionDecision;
      try {
        decision = await this.suppressions.evaluate({
          recipient: recipient.recipient,
          messageId: message.id,
          topic: message.topic,
          channel,
          endpointId: endpoint.id,
        });
      } catch (error) {
        throw new EngagementSuppressionEvaluationProblem(
          message.id,
          recipient.recipient,
          channel,
          normalizeError(error),
        );
      }
      if (!decision.suppressed) {
        eligible.push(endpoint);
      }
    }
    return eligible;
  }

  private async render<TMessage extends AnyMessage, TChannel extends TMessage["channels"][number]>(
    message: TMessage,
    command: EngagementSendCommand<TMessage>,
    channel: TChannel,
  ): Promise<MessageContent<TChannel>> {
    try {
      return await this.renderer.render(message, channel, command.data);
    } catch (error) {
      throw new EngagementRenderFailedProblem(
        message.id,
        command.recipient,
        channel,
        normalizeError(error),
      );
    }
  }
}

/** Reports that the requested recipient does not exist in the tenant-scoped directory. */
export class RecipientNotFoundProblem extends Problem {
  constructor(ref: RecipientRef) {
    super(
      "engagement-core/recipient-not-found",
      ProblemCategory.NotFound,
      `Recipient ${ref.userId} was not found in tenant ${ref.tenantId}`,
      { extensions: { tenantId: ref.tenantId, userId: ref.userId, retryable: false } },
    );
  }
}

/** Reports that the recipient directory could not complete a tenant-scoped lookup. */
export class RecipientDirectoryLookupProblem extends Problem {
  constructor(ref: RecipientRef, cause: Error) {
    super(
      "engagement-core/recipient-directory-lookup-failed",
      ProblemCategory.InternalServerError,
      `Recipient directory lookup failed for tenant ${ref.tenantId}`,
      {
        cause,
        extensions: { tenantId: ref.tenantId, userId: ref.userId, retryable: true },
      },
    );
  }
}

/** Reports that the recipient directory returned an identity outside the requested tenant scope. */
export class RecipientDirectoryScopeMismatchProblem extends Problem {
  constructor(ref: RecipientRef) {
    super(
      "engagement-core/recipient-directory-scope-mismatch",
      ProblemCategory.InternalServerError,
      `Recipient directory returned an identity outside tenant ${ref.tenantId}`,
      { extensions: { tenantId: ref.tenantId, userId: ref.userId, retryable: false } },
    );
  }
}

export class EngagementCommandInvalidProblem extends Problem {
  constructor(detail: string) {
    super("engagement-core/send-command-invalid", ProblemCategory.ValidationError, detail, {
      extensions: { retryable: false },
    });
  }
}

/** Reports that a registered message renderer failed while producing channel content. */
export class EngagementRenderFailedProblem extends Problem {
  constructor(messageId: string, ref: RecipientRef, channel: MessageChannel, cause: Error) {
    super(
      "engagement-core/render-failed",
      ProblemCategory.InternalServerError,
      `Rendering ${messageId} failed for channel ${channel}`,
      {
        cause,
        extensions: {
          messageId,
          tenantId: ref.tenantId,
          userId: ref.userId,
          channel,
          retryable: false,
        },
      },
    );
  }
}

/** Reports that endpoint suppression evaluation failed before notification dispatch. */
export class EngagementSuppressionEvaluationProblem extends Problem {
  constructor(messageId: string, ref: RecipientRef, channel: MessageChannel, cause: Error) {
    super(
      "engagement-core/suppression-evaluation-failed",
      ProblemCategory.InternalServerError,
      `Suppression evaluation failed for ${messageId} on channel ${channel}`,
      {
        cause,
        extensions: {
          messageId,
          tenantId: ref.tenantId,
          userId: ref.userId,
          channel,
          retryable: true,
        },
      },
    );
  }
}

export class EngagementDispatchFailedProblem extends Problem {
  constructor(
    messageId: string,
    ref: RecipientRef,
    channel: MessageChannel,
    channelResults: readonly EngagementChannelResult[],
    cause: Error,
  ) {
    super(
      "engagement-core/dispatch-failed",
      ProblemCategory.InternalServerError,
      `Dispatching ${messageId} failed for channel ${channel}`,
      {
        cause,
        extensions: {
          messageId,
          tenantId: ref.tenantId,
          userId: ref.userId,
          channel,
          channelResults,
          causeCode: cause instanceof Problem ? cause.code : "unknown",
          retryable: cause instanceof Problem && cause.extensions?.retryable === true,
        },
      },
    );
  }
}

function assertCommand(command: EngagementSendCommand<AnyMessage>): void {
  if (command.recipient.tenantId.length === 0) {
    throw new EngagementCommandInvalidProblem("Recipient tenantId must not be empty");
  }
  if (command.recipient.userId.length === 0) {
    throw new EngagementCommandInvalidProblem("Recipient userId must not be empty");
  }
  if (command.key.length === 0) {
    throw new EngagementCommandInvalidProblem("Semantic key must not be empty");
  }
}

function endpointsForChannel(
  recipient: ResolvedRecipient,
  channel: MessageChannel,
): readonly ResolvedEndpoint[] {
  switch (channel) {
    case "email":
      return recipient.email === undefined
        ? []
        : usableEndpoint(recipient.email.id, recipient.email.address);
    case "push":
      return recipient.push.flatMap((endpoint) => usableEndpoint(endpoint.id, endpoint.token));
    case "sms":
    case "inApp":
      return [];
  }
}

function usableEndpoint(id: string, target: string): readonly ResolvedEndpoint[] {
  return id.trim().length === 0 || target.trim().length === 0 ? [] : [{ id, target }];
}

function toNotificationChannel(channel: MessageChannel): NotificationChannel {
  switch (channel) {
    case "email":
      return NotificationChannel.EMAIL;
    case "push":
      return NotificationChannel.PUSH;
    case "sms":
      return NotificationChannel.SMS;
    case "inApp":
      return NotificationChannel.IN_APP;
  }
}

function toNotificationPayload<TChannel extends MessageChannel>(
  message: AnyMessage,
  recipient: ResolvedRecipient,
  channel: TChannel,
  endpoint: ResolvedEndpoint,
  content: MessageContent<TChannel>,
): NotificationPayload {
  const metadata: Record<string, unknown> = {
    messageId: message.id,
    topic: message.topic,
    ...(recipient.timezone === undefined ? {} : { timezone: recipient.timezone }),
  };

  switch (channel) {
    case "email": {
      const email = content as MessageContent<"email">;
      return {
        to: endpoint.target,
        subject: email.subject,
        content: email.html,
        ...(email.headers === undefined ? {} : { headers: email.headers }),
        metadata: {
          ...metadata,
          text: email.text,
          ...(email.replyTo === undefined ? {} : { replyTo: email.replyTo }),
        },
        ...(recipient.locale === undefined ? {} : { locale: recipient.locale }),
      };
    }
    case "push": {
      const push = content as MessageContent<"push">;
      return {
        to: endpoint.target,
        subject: push.title,
        content: push.body,
        metadata: {
          ...metadata,
          ...(push.deepLink === undefined ? {} : { deepLink: push.deepLink }),
        },
        ...(recipient.locale === undefined ? {} : { locale: recipient.locale }),
      };
    }
    case "sms":
      return { to: endpoint.target, content: (content as MessageContent<"sms">).body, metadata };
    case "inApp": {
      const inApp = content as MessageContent<"inApp">;
      return {
        to: endpoint.target,
        subject: inApp.title,
        content: inApp.body,
        metadata: {
          ...metadata,
          ...(inApp.deepLink === undefined ? {} : { deepLink: inApp.deepLink }),
        },
      };
    }
  }
}

function suppressionReason(
  channelResults: readonly EngagementChannelResult[],
): "preference" | "suppression" | "no-endpoint" {
  if (
    channelResults.some(
      (result) => result.status === "suppressed" && result.reason === "preference",
    )
  ) {
    return "preference";
  }
  if (channelResults.some((result) => result.status === "suppressed")) {
    return "suppression";
  }
  return "no-endpoint";
}

function snapshotRecipient(recipient: ResolvedRecipient): ResolvedRecipient {
  return Object.freeze({
    recipient: Object.freeze({ ...recipient.recipient }),
    ...(recipient.email === undefined ? {} : { email: Object.freeze({ ...recipient.email }) }),
    push: Object.freeze(recipient.push.map((endpoint) => Object.freeze({ ...endpoint }))),
    ...(recipient.locale === undefined ? {} : { locale: recipient.locale }),
    ...(recipient.timezone === undefined ? {} : { timezone: recipient.timezone }),
  });
}

function recipientKey(ref: RecipientRef): string {
  return `${encodeURIComponent(ref.tenantId)}:${encodeURIComponent(ref.userId)}`;
}

function rendererNameOf(renderer: object): string {
  return renderer.constructor.name || "anonymous renderer";
}

function normalizeError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

function freezeResult<T extends EngagementSendResult>(result: T): T {
  return Object.freeze({
    ...result,
    channelResults: Object.freeze([...result.channelResults]),
    ...(result.status === "queued"
      ? { executionIds: Object.freeze([...result.executionIds]) }
      : {}),
  }) as T;
}
