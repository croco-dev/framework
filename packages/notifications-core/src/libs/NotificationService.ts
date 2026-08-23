// Constructor dependencies must remain runtime values for emitted design:paramtypes metadata.
/* oxlint-disable typescript/consistent-type-imports */
import { Component } from "@croco/framework-context";
import { TaskRunner } from "@croco/tasks-core";
import {
  createNotificationDispatchRequest,
  toNotificationJobPayload,
  type NotificationOutboxReference,
} from "./NotificationDispatch";
import {
  NotificationPreferenceEvaluator,
  type NotificationPreferenceContext,
  type NotificationPreferenceDecision,
  type NotificationPreferenceRule,
} from "./NotificationPreferences";
import { NotificationProviderRegistry } from "./NotificationProviderRegistry";
import {
  NotificationTemplateRegistry,
  type NotificationTemplate,
  type NotificationTemplateRef,
  type NotificationTemplateRenderRequest,
  type NotificationTemplateRenderResult,
  type NotificationTemplateSendRequest,
} from "./NotificationTemplates";
import {
  NotificationIdempotencyKeyRequiredProblem,
  NotificationOutboxIdempotencyMismatchProblem,
  NotificationPreferenceChannelMismatchProblem,
  NotificationPreferenceContextRequiredProblem,
  NotificationPreferenceDeniedProblem,
  NotificationProviderChannelMismatchProblem,
  NotificationProviderNotConfiguredProblem,
  NotificationProviderNotRegisteredProblem,
  NotificationProviderIdempotencyUnsupportedProblem,
} from "./problems/NotificationProblems";
import type { NotificationChannel, NotificationPayload, NotificationProvider } from "./types";

export type NotificationSendContractOptions = {
  readonly providerName?: string;
  readonly idempotencyKey: string;
  readonly preferenceContext: NotificationPreferenceContext;
  readonly outbox?: NotificationOutboxReference;
  readonly requireProviderIdempotency?: true;
};

export type UnsafeNotificationSendOptions = {
  readonly providerName?: string;
  readonly idempotencyKey?: string;
  readonly outbox?: NotificationOutboxReference;
  readonly unsafeSkipPreferenceEvaluation: true;
  readonly unsafeAllowMissingIdempotencyKey?: true;
  readonly requireProviderIdempotency?: true;
};

export type NotificationSendServiceOptions =
  | NotificationSendContractOptions
  | UnsafeNotificationSendOptions;

type EvaluatedNotificationSendContract = {
  readonly idempotencyKey?: string;
  readonly preferenceDecision?: NotificationPreferenceDecision;
};

@Component()
export class NotificationService {
  private readonly preferences = new NotificationPreferenceEvaluator();
  private readonly templates = new NotificationTemplateRegistry();

  constructor(
    private taskRunner: TaskRunner,
    private registry: NotificationProviderRegistry,
  ) {}

  registerProvider(provider: NotificationProvider, isDefault = false) {
    this.registry.registerProvider(provider, isDefault);
  }

  registerPreferenceRule(rule: NotificationPreferenceRule): void {
    this.preferences.registerRule(rule);
  }

  registerTemplate(template: NotificationTemplate): void {
    this.templates.registerTemplate(template);
  }

  renderTemplate(request: NotificationTemplateRenderRequest): NotificationTemplateRenderResult {
    return this.templates.render(request);
  }

  async sendTemplate(
    channel: NotificationChannel,
    request: NotificationTemplateSendRequest,
    options: NotificationSendServiceOptions,
  ): Promise<void> {
    const rendered = this.renderTemplate({
      id: request.template.id,
      version: request.template.version,
      locale: request.template.locale,
      channel,
      variables: request.variables,
    });

    await this.send(
      channel,
      {
        to: request.to,
        ...(rendered.subject === undefined ? {} : { subject: rendered.subject }),
        content: rendered.content,
        ...(request.metadata === undefined ? {} : { metadata: request.metadata }),
        templateId: rendered.template.id,
        templateVersion: rendered.template.version,
        locale: rendered.template.locale,
        variables: rendered.variables,
      },
      options,
    );
  }

  /**
   * Send a notification via task execution.
   *
   * This method waits for the configured TaskRunner to execute the
   * `send-notification` task, so task and provider failures are propagated
   * back to the caller.
   */
  async send(
    channel: NotificationChannel,
    payload: NotificationPayload,
    options: NotificationSendServiceOptions,
  ): Promise<void> {
    const normalizedOptions = normalizeNotificationSendOptions(options);
    const providerName = normalizedOptions?.providerName;
    const outbox = normalizedOptions?.outbox;
    const targetProviderName = providerName ?? this.registry.getDefaultProviderName(channel);

    if (targetProviderName === undefined) {
      throw new NotificationProviderNotConfiguredProblem(channel);
    }

    const provider = this.registry.getProvider(targetProviderName);

    if (!provider) {
      throw new NotificationProviderNotRegisteredProblem(targetProviderName);
    }

    const providerChannel = provider.getChannel();

    if (providerChannel !== channel) {
      throw new NotificationProviderChannelMismatchProblem(
        targetProviderName,
        channel,
        providerChannel,
      );
    }

    const sendContract = this.evaluateSendContract(channel, normalizedOptions);
    const template = getPayloadTemplateRef(payload);
    const providerCapabilities = this.registry.getProviderCapabilities(targetProviderName);

    if (providerCapabilities === undefined) {
      throw new NotificationProviderNotRegisteredProblem(targetProviderName);
    }
    if (
      normalizedOptions?.requireProviderIdempotency === true &&
      !providerCapabilities.supportsIdempotencyKey
    ) {
      throw new NotificationProviderIdempotencyUnsupportedProblem(targetProviderName, channel);
    }

    const dispatchRequest = createNotificationDispatchRequest({
      providerName: targetProviderName,
      channel,
      payload,
      providerCapabilities,
      ...(sendContract.idempotencyKey === undefined
        ? {}
        : { idempotencyKey: sendContract.idempotencyKey }),
      ...(outbox === undefined ? {} : { outbox }),
      ...(sendContract.preferenceDecision === undefined
        ? {}
        : { preferenceDecision: sendContract.preferenceDecision }),
      ...(template === undefined ? {} : { template }),
    });

    await this.taskRunner.execute("send-notification", toNotificationJobPayload(dispatchRequest));
  }

  private evaluateSendContract(
    channel: NotificationChannel,
    options: NormalizedNotificationSendServiceOptions | undefined,
  ): EvaluatedNotificationSendContract {
    if (isUnsafeNotificationSendOptions(options)) {
      if (options.idempotencyKey === undefined && !options.unsafeAllowMissingIdempotencyKey) {
        throw new NotificationIdempotencyKeyRequiredProblem(channel);
      }

      assertOutboxIdempotency(channel, options.idempotencyKey, options.outbox);

      return options.idempotencyKey === undefined ? {} : { idempotencyKey: options.idempotencyKey };
    }

    if (options?.preferenceContext === undefined) {
      throw new NotificationPreferenceContextRequiredProblem(channel);
    }

    if (options.preferenceContext.channel !== channel) {
      throw new NotificationPreferenceChannelMismatchProblem(
        channel,
        options.preferenceContext.channel,
      );
    }

    if (options.idempotencyKey === undefined) {
      throw new NotificationIdempotencyKeyRequiredProblem(channel);
    }

    assertOutboxIdempotency(channel, options.idempotencyKey, options.outbox);

    const decision = this.preferences.evaluate(options.preferenceContext);

    if (!decision.allowed) {
      throw new NotificationPreferenceDeniedProblem(decision);
    }

    return {
      idempotencyKey: options.idempotencyKey,
      preferenceDecision: decision,
    };
  }
}

type NormalizedNotificationSendServiceOptions =
  | Partial<NotificationSendContractOptions>
  | UnsafeNotificationSendOptions;

function normalizeNotificationSendOptions(
  options: NotificationSendServiceOptions | string | undefined,
): NormalizedNotificationSendServiceOptions | undefined {
  if (typeof options === "string") {
    return { providerName: options };
  }

  return options;
}

function isUnsafeNotificationSendOptions(
  options: NormalizedNotificationSendServiceOptions | undefined,
): options is UnsafeNotificationSendOptions {
  return (
    options !== undefined &&
    "unsafeSkipPreferenceEvaluation" in options &&
    options.unsafeSkipPreferenceEvaluation === true
  );
}

function assertOutboxIdempotency(
  channel: NotificationChannel,
  idempotencyKey: string | undefined,
  outbox: NotificationOutboxReference | undefined,
): void {
  if (outbox === undefined) {
    return;
  }

  if (idempotencyKey === undefined || outbox.idempotencyKey !== idempotencyKey) {
    throw new NotificationOutboxIdempotencyMismatchProblem(channel);
  }
}

function getPayloadTemplateRef(payload: NotificationPayload): NotificationTemplateRef | undefined {
  if (
    payload.templateId === undefined ||
    payload.templateVersion === undefined ||
    payload.locale === undefined
  ) {
    return undefined;
  }

  return {
    id: payload.templateId,
    version: payload.templateVersion,
    locale: payload.locale,
  };
}
