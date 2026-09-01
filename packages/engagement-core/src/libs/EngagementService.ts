import {
  NotificationChannel,
  NotificationPreferenceDeniedProblem,
  type NotificationDispatchPreparation,
  type NotificationDispatchPreparationOptions,
  type NotificationPayload,
} from "@croco/notifications-core";
import { Problem, ProblemCategory } from "@croco/problems-core";
import {
  EngagementPersistenceProblem,
  type EngagementDispatch,
  type EngagementDispatchStore,
  type EngagementDispatchTarget,
} from "./EngagementStores";
import {
  MessageDataInvalidProblem,
  MessageRendererAlreadyRegisteredProblem,
  MessageRendererMissingProblem,
  RENDER_PARSED_MESSAGE,
  parseMessageData,
  type AnyMessage,
  type MessageChannel,
  type MessageContent,
  type MessageData,
  type MessageDataInput,
  type MessageRenderer,
  type MessageRendererRegistry,
} from "./MessageContracts";
import type { RecipientRef } from "./RecipientContracts";

export type { RecipientRef } from "./RecipientContracts";

export type EmailEndpoint = Readonly<{
  id: string;
  address: string;
  version?: number;
}>;

export type PushEndpoint = Readonly<{
  id: string;
  token: string;
  provider?: string;
  app?: string;
  platform?: string;
  environment?: string;
  lastSeenAt?: Date;
  version?: number;
}>;

export type ResolvedRecipient = Readonly<{
  recipient: RecipientRef;
  email?: EmailEndpoint;
  emails?: readonly EmailEndpoint[];
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
  data: MessageDataInput<TMessage>;
  key: string;
  policy?: EngagementDeliveryPolicy;
}>;

type ParsedEngagementSendCommand<TMessage extends AnyMessage> = Readonly<{
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
  prepareDispatch(
    channel: NotificationChannel,
    options: NotificationDispatchPreparationOptions,
  ): NotificationDispatchPreparation;
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
  kind?: "preference" | "suppression";
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
    return this.registry[RENDER_PARSED_MESSAGE](
      message,
      this.resolver.resolve(message),
      channel,
      data,
    );
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
  version: number;
}>;

type PreparedEngagementChannel =
  | Readonly<{
      channel: MessageChannel;
      eligibleEndpoints: readonly ResolvedEndpoint[];
      dispatchPreparation: NotificationDispatchPreparation;
      content: MessageContent<MessageChannel>;
    }>
  | Readonly<{
      result: EngagementChannelResult;
      endpoints: readonly ResolvedEndpoint[];
    }>;

type SuppressionFilterResult = Readonly<{
  eligibleEndpoints: readonly ResolvedEndpoint[];
  deniedReason?: "preference" | "suppression";
}>;

export type EngagementIdempotencyKeyInput = Readonly<{
  tenantId: string;
  messageId: string;
  userId: string;
  channel: MessageChannel;
  semanticKey: string;
  endpointId: string;
  endpointVersion?: number;
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
    ...(input.endpointVersion === undefined ? [] : [String(input.endpointVersion)]),
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
    private readonly dispatches?: EngagementDispatchStore,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  async send<TMessage extends AnyMessage>(
    message: TMessage,
    command: EngagementSendCommand<TMessage>,
  ): Promise<EngagementSendResult> {
    assertCommand(command);
    const normalizedCommand: ParsedEngagementSendCommand<TMessage> = {
      ...command,
      data: parseMessageData(message, command.data),
    };
    const completedReplay = await this.replayCompletedSend(message, normalizedCommand);
    if (completedReplay !== undefined) return completedReplay;

    const recipient = await this.resolveRecipient(normalizedCommand.recipient);
    const policy = normalizedCommand.policy ?? "first-reachable";
    const channelResults: EngagementChannelResult[] = [];
    const executionIds: string[] = [];

    if (policy === "all-reachable") {
      const preparedChannels = await this.prepareAllReachable(
        message,
        normalizedCommand,
        recipient,
      );
      for (const prepared of preparedChannels) {
        if ("result" in prepared) {
          channelResults.push(prepared.result);
          if (prepared.result.status === "queued") {
            executionIds.push(...prepared.result.executionIds);
          }
          await this.recordChannelResult(
            message,
            normalizedCommand,
            prepared.result,
            prepared.endpoints,
          );
          continue;
        }
        await this.dispatchChannel(
          message,
          normalizedCommand,
          recipient,
          prepared.channel,
          prepared.eligibleEndpoints,
          prepared.dispatchPreparation,
          prepared.content,
          channelResults,
          executionIds,
        );
      }

      return engagementResult(channelResults, executionIds);
    }

    for (const channel of message.channels) {
      const endpoints = endpointsForChannel(recipient, channel);
      const replay = await this.replayChannel(message, normalizedCommand, channel, channelResults);
      if (replay !== undefined) {
        channelResults.push(replay);
        if (replay.status === "queued") executionIds.push(...replay.executionIds);
        continue;
      }

      if (executionIds.length > 0) {
        const result: EngagementChannelResult =
          endpoints.length === 0
            ? { channel, status: "unavailable", reason: "no-endpoint" }
            : { channel, status: "skipped", reason: "policy" };
        channelResults.push(result);
        await this.recordChannelResult(message, normalizedCommand, result, endpoints);
        continue;
      }

      if (endpoints.length === 0) {
        const result = { channel, status: "unavailable", reason: "no-endpoint" } as const;
        channelResults.push(result);
        await this.recordChannelResult(message, normalizedCommand, result, endpoints);
        continue;
      }

      const dispatchPreparation = await this.prepareNotificationDispatch(
        message,
        normalizedCommand,
        channel,
        channelResults,
        endpoints,
      );
      if (dispatchPreparation === undefined) {
        const result = { channel, status: "suppressed", reason: "preference" } as const;
        channelResults.push(result);
        await this.recordChannelResult(message, normalizedCommand, result, endpoints);
        continue;
      }

      const suppression = await this.filterSuppressedEndpoints(
        message,
        recipient,
        endpoints,
        channel,
      );
      if (suppression.eligibleEndpoints.length === 0) {
        const result = {
          channel,
          status: "suppressed",
          reason: suppression.deniedReason ?? "suppression",
        } as const;
        channelResults.push(result);
        await this.recordChannelResult(message, normalizedCommand, result, endpoints);
        continue;
      }

      const content = await this.render(
        message,
        normalizedCommand,
        channel,
        suppression.eligibleEndpoints,
      );
      await this.dispatchChannel(
        message,
        normalizedCommand,
        recipient,
        channel,
        suppression.eligibleEndpoints,
        dispatchPreparation,
        content,
        channelResults,
        executionIds,
      );
    }

    return engagementResult(channelResults, executionIds);
  }

  private async prepareAllReachable<TMessage extends AnyMessage>(
    message: TMessage,
    command: ParsedEngagementSendCommand<TMessage>,
    recipient: ResolvedRecipient,
  ): Promise<readonly PreparedEngagementChannel[]> {
    const preparedChannels: PreparedEngagementChannel[] = [];
    for (const channel of message.channels) {
      const endpoints = endpointsForChannel(recipient, channel);
      const completedResults = preparedChannels.flatMap((prepared) =>
        "result" in prepared ? [prepared.result] : [],
      );
      const replay = await this.replayChannel(message, command, channel, completedResults);
      if (replay !== undefined) {
        preparedChannels.push({ result: replay, endpoints });
        continue;
      }
      if (endpoints.length === 0) {
        preparedChannels.push({
          result: { channel, status: "unavailable", reason: "no-endpoint" },
          endpoints,
        });
        continue;
      }

      const dispatchPreparation = await this.prepareNotificationDispatch(
        message,
        command,
        channel,
        preparedChannels.flatMap((prepared) => ("result" in prepared ? [prepared.result] : [])),
        endpoints,
      );
      if (dispatchPreparation === undefined) {
        preparedChannels.push({
          result: { channel, status: "suppressed", reason: "preference" },
          endpoints,
        });
        continue;
      }

      const suppression = await this.filterSuppressedEndpoints(
        message,
        recipient,
        endpoints,
        channel,
      );
      if (suppression.eligibleEndpoints.length === 0) {
        preparedChannels.push({
          result: {
            channel,
            status: "suppressed",
            reason: suppression.deniedReason ?? "suppression",
          },
          endpoints,
        });
        continue;
      }

      preparedChannels.push({
        channel,
        eligibleEndpoints: suppression.eligibleEndpoints,
        dispatchPreparation,
        content: await this.render(message, command, channel, suppression.eligibleEndpoints),
      });
    }
    return preparedChannels;
  }

  private async prepareNotificationDispatch<TMessage extends AnyMessage>(
    message: TMessage,
    command: ParsedEngagementSendCommand<TMessage>,
    channel: TMessage["channels"][number],
    channelResults: readonly EngagementChannelResult[],
    endpoints: readonly ResolvedEndpoint[],
  ): Promise<NotificationDispatchPreparation | undefined> {
    try {
      return this.notifications.prepareDispatch(toNotificationChannel(channel), {
        preferenceContext: {
          tenantId: command.recipient.tenantId,
          userId: command.recipient.userId,
          channel: toNotificationChannel(channel),
          topic: message.topic,
        },
      });
    } catch (error) {
      if (error instanceof NotificationPreferenceDeniedProblem) {
        return undefined;
      }
      await this.recordFailure(message, command, channel, endpoints, error, "preparation");
      throw new EngagementDispatchFailedProblem(
        message.id,
        command.recipient,
        channel,
        channelResults,
        normalizeError(error),
      );
    }
  }

  private async dispatchChannel(
    message: AnyMessage,
    command: Readonly<{ recipient: RecipientRef; key: string }>,
    recipient: ResolvedRecipient,
    channel: MessageChannel,
    eligibleEndpoints: readonly ResolvedEndpoint[],
    dispatchPreparation: NotificationDispatchPreparation,
    content: MessageContent<MessageChannel>,
    channelResults: EngagementChannelResult[],
    executionIds: string[],
  ): Promise<void> {
    const channelExecutionIds: string[] = [];

    for (const endpoint of eligibleEndpoints) {
      try {
        const result = await dispatchPreparation.dispatch(
          toNotificationPayload(message, recipient, channel, endpoint, content),
          {
            idempotencyKey: createEngagementIdempotencyKey({
              tenantId: command.recipient.tenantId,
              messageId: message.id,
              userId: command.recipient.userId,
              channel,
              semanticKey: command.key,
              endpointId: endpoint.id,
              endpointVersion: endpoint.version,
            }),
          },
        );
        channelExecutionIds.push(result.executionId);
        executionIds.push(result.executionId);
      } catch (error) {
        await this.recordFailure(
          message,
          command,
          channel,
          eligibleEndpoints,
          error,
          "provider",
          channelExecutionIds,
        );
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
      const result = { channel, status: "queued", executionIds: channelExecutionIds } as const;
      channelResults.push(result);
      await this.recordChannelResult(message, command, result, eligibleEndpoints);
    }
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
  ): Promise<SuppressionFilterResult> {
    const eligible: ResolvedEndpoint[] = [];
    let deniedReason: "preference" | "suppression" | undefined;
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
      } else if (decision.kind === "preference") {
        deniedReason = "preference";
      } else if (deniedReason === undefined) {
        deniedReason = "suppression";
      }
    }
    return {
      eligibleEndpoints: eligible,
      ...(deniedReason === undefined ? {} : { deniedReason }),
    };
  }

  private async render<TMessage extends AnyMessage, TChannel extends TMessage["channels"][number]>(
    message: TMessage,
    command: ParsedEngagementSendCommand<TMessage>,
    channel: TChannel,
    endpoints: readonly ResolvedEndpoint[],
  ): Promise<MessageContent<TChannel>> {
    try {
      return await this.renderer.render(message, channel, command.data);
    } catch (error) {
      if (error instanceof MessageDataInvalidProblem) {
        throw error;
      }
      await this.recordFailure(message, command, channel, endpoints, error, "render");
      throw new EngagementRenderFailedProblem(
        message.id,
        command.recipient,
        channel,
        normalizeError(error),
      );
    }
  }

  private async replayChannel(
    message: AnyMessage,
    command: Readonly<{ recipient: RecipientRef; key: string }>,
    channel: MessageChannel,
    previousResults: readonly EngagementChannelResult[],
  ): Promise<EngagementChannelResult | undefined> {
    if (this.dispatches === undefined) return undefined;
    let dispatch: EngagementDispatch | undefined;
    try {
      dispatch = await this.dispatches.findByIdentity({
        tenantId: command.recipient.tenantId,
        messageId: message.id,
        recipientId: command.recipient.userId,
        channel,
        semanticKey: command.key,
      });
    } catch (error) {
      throw new EngagementPersistenceProblem(
        "find-dispatch",
        command.recipient.tenantId,
        normalizeError(error),
      );
    }
    return dispatch === undefined
      ? undefined
      : channelResultFromDispatch(dispatch, command.recipient, previousResults);
  }

  private async replayCompletedSend(
    message: AnyMessage,
    command: Readonly<{ recipient: RecipientRef; key: string }>,
  ): Promise<EngagementSendResult | undefined> {
    if (this.dispatches === undefined) return undefined;
    const channelResults: EngagementChannelResult[] = [];
    const executionIds: string[] = [];
    let complete = true;

    for (const channel of message.channels) {
      const replay = await this.replayChannel(message, command, channel, channelResults);
      if (replay === undefined) {
        complete = false;
        continue;
      }
      channelResults.push(replay);
      if (replay.status === "queued") executionIds.push(...replay.executionIds);
    }

    return complete ? engagementResult(channelResults, executionIds) : undefined;
  }

  private async recordChannelResult(
    message: AnyMessage,
    command: Readonly<{ recipient: RecipientRef; key: string }>,
    result: EngagementChannelResult,
    endpoints: readonly ResolvedEndpoint[],
  ): Promise<void> {
    if (this.dispatches === undefined) return;
    try {
      await this.dispatches.recordDispatch({
        tenantId: command.recipient.tenantId,
        messageId: message.id,
        recipientId: command.recipient.userId,
        channel: result.channel,
        semanticKey: command.key,
        topic: message.topic,
        targets: dispatchTargets(endpoints, result),
        outcome:
          result.status === "queued"
            ? { kind: "queued", executionIds: result.executionIds }
            : result.status === "suppressed"
              ? { kind: "suppressed", reason: result.reason }
              : result.status === "unavailable"
                ? { kind: "unavailable", reason: result.reason }
                : { kind: "skipped", reason: result.reason },
        recordedAt: this.clock(),
      });
    } catch (error) {
      throw new EngagementPersistenceProblem(
        "record-dispatch",
        command.recipient.tenantId,
        normalizeError(error),
      );
    }
  }

  private async recordFailure(
    message: AnyMessage,
    command: Readonly<{ recipient: RecipientRef; key: string }>,
    channel: MessageChannel,
    endpoints: readonly ResolvedEndpoint[],
    error: unknown,
    stage: "preparation" | "render" | "provider" | "network" | "persistence",
    executionIds: readonly string[] = [],
  ): Promise<void> {
    if (this.dispatches === undefined) return;
    const cause = normalizeError(error);
    try {
      await this.dispatches.recordDispatch({
        tenantId: command.recipient.tenantId,
        messageId: message.id,
        recipientId: command.recipient.userId,
        channel,
        semanticKey: command.key,
        topic: message.topic,
        targets: dispatchTargets(endpoints, {
          channel,
          status: "queued",
          executionIds,
        }),
        outcome: {
          kind: "failed",
          stage,
          failureCode: cause instanceof Problem ? cause.code : "unknown",
          retryable: cause instanceof Problem && cause.extensions?.retryable === true,
          executionIds,
        },
        recordedAt: this.clock(),
      });
    } catch (persistenceError) {
      throw new EngagementPersistenceProblem(
        "record-failed-dispatch",
        command.recipient.tenantId,
        normalizeError(persistenceError),
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

/** Reports that an engagement send command is malformed at the runtime boundary. */
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

/** Reports that a prepared engagement channel failed during notification dispatch. */
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

/** Reports that a durable logical dispatch already ended in failure. */
export class EngagementRecordedDispatchFailureProblem extends Problem {
  constructor(dispatch: EngagementDispatch) {
    if (dispatch.outcome.kind !== "failed") {
      throw new EngagementCommandInvalidProblem(
        "A recorded dispatch failure requires a failed dispatch outcome",
      );
    }
    super(
      "engagement-core/recorded-dispatch-failed",
      ProblemCategory.InternalServerError,
      `Dispatch ${dispatch.id} already failed during ${dispatch.outcome.stage}`,
      {
        extensions: {
          dispatchId: dispatch.id,
          tenantId: dispatch.tenantId,
          messageId: dispatch.messageId,
          recipientId: dispatch.recipientId,
          channel: dispatch.channel,
          stage: dispatch.outcome.stage,
          failureCode: dispatch.outcome.failureCode,
          providerRetryable: dispatch.outcome.retryable,
          retryable: false,
        },
      },
    );
  }
}

function assertCommand(command: unknown): asserts command is EngagementSendCommand<AnyMessage> {
  if (typeof command !== "object" || command === null) {
    throw new EngagementCommandInvalidProblem("Engagement command must be an object");
  }

  const recipient = "recipient" in command ? command.recipient : undefined;
  if (typeof recipient !== "object" || recipient === null) {
    throw new EngagementCommandInvalidProblem("Recipient must be an object");
  }

  const tenantId = "tenantId" in recipient ? recipient.tenantId : undefined;
  if (typeof tenantId !== "string" || tenantId.length === 0) {
    throw new EngagementCommandInvalidProblem("Recipient tenantId must not be empty");
  }

  const userId = "userId" in recipient ? recipient.userId : undefined;
  if (typeof userId !== "string" || userId.length === 0) {
    throw new EngagementCommandInvalidProblem("Recipient userId must not be empty");
  }

  const key = "key" in command ? command.key : undefined;
  if (typeof key !== "string" || key.length === 0) {
    throw new EngagementCommandInvalidProblem("Semantic key must not be empty");
  }
  const policy = "policy" in command ? command.policy : undefined;
  if (policy !== undefined && policy !== "first-reachable" && policy !== "all-reachable") {
    throw new EngagementCommandInvalidProblem(
      "Delivery policy must be first-reachable or all-reachable",
    );
  }
}

function channelResultFromDispatch(
  dispatch: EngagementDispatch,
  recipient: RecipientRef,
  previousResults: readonly EngagementChannelResult[],
): EngagementChannelResult {
  switch (dispatch.outcome.kind) {
    case "queued":
      return {
        channel: dispatch.channel,
        status: "queued" as const,
        executionIds: dispatch.outcome.executionIds,
      };
    case "suppressed":
      return {
        channel: dispatch.channel,
        status: "suppressed",
        reason: dispatch.outcome.reason,
      };
    case "unavailable":
      return {
        channel: dispatch.channel,
        status: "unavailable",
        reason: dispatch.outcome.reason,
      };
    case "skipped":
      return {
        channel: dispatch.channel,
        status: "skipped",
        reason: dispatch.outcome.reason,
      };
    case "failed":
      throw new EngagementDispatchFailedProblem(
        dispatch.messageId,
        recipient,
        dispatch.channel,
        [
          ...previousResults,
          ...(dispatch.outcome.executionIds.length === 0
            ? []
            : [
                {
                  channel: dispatch.channel,
                  status: "queued" as const,
                  executionIds: dispatch.outcome.executionIds,
                },
              ]),
        ],
        new EngagementRecordedDispatchFailureProblem(dispatch),
      );
  }
}

function dispatchTargets(
  endpoints: readonly ResolvedEndpoint[],
  result?: EngagementChannelResult,
): readonly EngagementDispatchTarget[] {
  return endpoints.map((endpoint, index) => ({
    endpointId: endpoint.id,
    endpointVersion: endpoint.version,
    ...(result?.status === "queued" && result.executionIds[index] !== undefined
      ? { executionId: result.executionIds[index] }
      : {}),
  }));
}

function endpointsForChannel(
  recipient: ResolvedRecipient,
  channel: MessageChannel,
): readonly ResolvedEndpoint[] {
  switch (channel) {
    case "email": {
      const emails = recipient.emails ?? (recipient.email === undefined ? [] : [recipient.email]);
      return emails.flatMap((endpoint) =>
        usableEndpoint(endpoint.id, endpoint.address, endpoint.version),
      );
    }
    case "push":
      return recipient.push.flatMap((endpoint) =>
        usableEndpoint(endpoint.id, endpoint.token, endpoint.version),
      );
    case "sms":
    case "inApp":
      return [];
  }
}

function usableEndpoint(id: string, target: string, version = 1): readonly ResolvedEndpoint[] {
  return id.trim().length === 0 || target.trim().length === 0 ? [] : [{ id, target, version }];
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
        text: email.text,
        ...(email.replyTo === undefined ? {} : { replyTo: email.replyTo }),
        ...(email.headers === undefined ? {} : { headers: email.headers }),
        metadata,
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

function engagementResult(
  channelResults: readonly EngagementChannelResult[],
  executionIds: readonly string[],
): EngagementSendResult {
  if (executionIds.length > 0) {
    return freezeResult({ status: "queued", executionIds, channelResults });
  }

  return freezeResult({
    status: "suppressed",
    reason: suppressionReason(channelResults),
    channelResults,
  });
}

function snapshotRecipient(recipient: ResolvedRecipient): ResolvedRecipient {
  return Object.freeze({
    recipient: Object.freeze({ ...recipient.recipient }),
    ...(recipient.email === undefined ? {} : { email: Object.freeze({ ...recipient.email }) }),
    ...(recipient.emails === undefined
      ? {}
      : {
          emails: Object.freeze(recipient.emails.map((endpoint) => Object.freeze({ ...endpoint }))),
        }),
    push: Object.freeze(
      recipient.push.map((endpoint) =>
        Object.freeze({
          ...endpoint,
          ...(endpoint.lastSeenAt === undefined
            ? {}
            : { lastSeenAt: new Date(endpoint.lastSeenAt.getTime()) }),
        }),
      ),
    ),
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
