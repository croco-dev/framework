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
import type {
  NotificationChannel,
  NotificationPayload,
  NotificationProvider,
  NotificationProviderCapabilities,
} from "./types";

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

export type NotificationDispatchResult = Readonly<{
  executionId: string;
}>;

/** Inputs evaluated before a notification payload is rendered. */
export type NotificationDispatchPreparationOptions = Readonly<{
  providerName?: string;
  preferenceContext: NotificationPreferenceContext;
  requireProviderIdempotency?: true;
}>;

/** Delivery inputs supplied after notification rendering completes. */
export type NotificationPreparedDispatchOptions = Readonly<{
  idempotencyKey: string;
  outbox?: NotificationOutboxReference;
}>;

/** A dispatch function bound to the provider and preference decision captured during preparation. */
export interface NotificationDispatchPreparation {
  dispatch(
    payload: NotificationPayload,
    options: NotificationPreparedDispatchOptions,
  ): Promise<NotificationDispatchResult>;
}

type PreparedProvider = Readonly<{
  providerName: string;
  providerCapabilities: NotificationProviderCapabilities;
}>;

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
    await this.dispatch(channel, payload, options);
  }

  /** Dispatches through the same task path as send() while retaining the execution identifier. */
  async dispatch(
    channel: NotificationChannel,
    payload: NotificationPayload,
    options: NotificationSendServiceOptions,
  ): Promise<NotificationDispatchResult> {
    const normalizedOptions = normalizeNotificationSendOptions(options);
    if (isUnsafeNotificationSendOptions(normalizedOptions)) {
      const provider = this.prepareProvider(
        channel,
        normalizedOptions.providerName,
        normalizedOptions.requireProviderIdempotency,
      );
      if (
        normalizedOptions.idempotencyKey === undefined &&
        !normalizedOptions.unsafeAllowMissingIdempotencyKey
      ) {
        throw new NotificationIdempotencyKeyRequiredProblem(channel);
      }
      assertOutboxIdempotency(channel, normalizedOptions.idempotencyKey, normalizedOptions.outbox);
      return this.executeDispatch(
        channel,
        provider,
        payload,
        normalizedOptions.idempotencyKey,
        normalizedOptions.outbox,
      );
    }

    if (normalizedOptions?.preferenceContext === undefined) {
      throw new NotificationPreferenceContextRequiredProblem(channel);
    }
    if (normalizedOptions.idempotencyKey === undefined) {
      throw new NotificationIdempotencyKeyRequiredProblem(channel);
    }

    const preparation = this.prepareDispatch(channel, {
      ...(normalizedOptions.providerName === undefined
        ? {}
        : { providerName: normalizedOptions.providerName }),
      preferenceContext: normalizedOptions.preferenceContext,
      ...(normalizedOptions.requireProviderIdempotency === undefined
        ? {}
        : { requireProviderIdempotency: normalizedOptions.requireProviderIdempotency }),
    });
    return preparation.dispatch(payload, {
      idempotencyKey: normalizedOptions.idempotencyKey,
      ...(normalizedOptions.outbox === undefined ? {} : { outbox: normalizedOptions.outbox }),
    });
  }

  /** Evaluates provider availability and notification preference before payload rendering. */
  prepareDispatch(
    channel: NotificationChannel,
    options: NotificationDispatchPreparationOptions,
  ): NotificationDispatchPreparation {
    if (options.preferenceContext.channel !== channel) {
      throw new NotificationPreferenceChannelMismatchProblem(
        channel,
        options.preferenceContext.channel,
      );
    }

    const provider = this.prepareProvider(
      channel,
      options.providerName,
      options.requireProviderIdempotency,
    );
    const preferenceDecision = this.preferences.evaluate(options.preferenceContext);
    if (!preferenceDecision.allowed) {
      throw new NotificationPreferenceDeniedProblem(preferenceDecision);
    }

    return Object.freeze({
      dispatch: async (
        payload: NotificationPayload,
        dispatchOptions: NotificationPreparedDispatchOptions,
      ) => {
        assertOutboxIdempotency(channel, dispatchOptions.idempotencyKey, dispatchOptions.outbox);
        return this.executeDispatch(
          channel,
          provider,
          payload,
          dispatchOptions.idempotencyKey,
          dispatchOptions.outbox,
          preferenceDecision,
        );
      },
    });
  }

  private prepareProvider(
    channel: NotificationChannel,
    providerName: string | undefined,
    requireProviderIdempotency: true | undefined,
  ): PreparedProvider {
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

    const providerCapabilities = this.registry.getProviderCapabilities(targetProviderName);

    if (providerCapabilities === undefined) {
      throw new NotificationProviderNotRegisteredProblem(targetProviderName);
    }
    if (requireProviderIdempotency === true && !providerCapabilities.supportsIdempotencyKey) {
      throw new NotificationProviderIdempotencyUnsupportedProblem(targetProviderName, channel);
    }

    return { providerName: targetProviderName, providerCapabilities };
  }

  private async executeDispatch(
    channel: NotificationChannel,
    provider: PreparedProvider,
    payload: NotificationPayload,
    idempotencyKey: string | undefined,
    outbox: NotificationOutboxReference | undefined,
    preferenceDecision?: NotificationPreferenceDecision,
  ): Promise<NotificationDispatchResult> {
    const template = getPayloadTemplateRef(payload);

    const dispatchRequest = createNotificationDispatchRequest({
      providerName: provider.providerName,
      channel,
      payload,
      providerCapabilities: provider.providerCapabilities,
      ...(idempotencyKey === undefined ? {} : { idempotencyKey }),
      ...(outbox === undefined ? {} : { outbox }),
      ...(preferenceDecision === undefined ? {} : { preferenceDecision }),
      ...(template === undefined ? {} : { template }),
    });

    const execution = await this.taskRunner.executeTracked(
      "send-notification",
      toNotificationJobPayload(dispatchRequest),
      idempotencyKey === undefined ? {} : { idempotencyKey },
    );
    return { executionId: execution.executionId };
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
