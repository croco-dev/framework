import { Component } from "@croco/framework-context";
import type { TaskRunner } from "@croco/tasks-core";
import type { NotificationProviderRegistry } from "./NotificationProviderRegistry";
import {
  NotificationProviderChannelMismatchProblem,
  NotificationProviderNotConfiguredProblem,
  NotificationProviderNotRegisteredProblem,
} from "./problems/NotificationProblems";
import type {
  NotificationChannel,
  NotificationJobPayload,
  NotificationPayload,
  NotificationProvider,
} from "./types";

type NotificationSendServiceOptions = {
  providerName?: string;
  idempotencyKey?: string;
};

@Component()
export class NotificationService {
  constructor(
    private taskRunner: TaskRunner,
    private registry: NotificationProviderRegistry,
  ) {}

  registerProvider(provider: NotificationProvider, isDefault = false) {
    this.registry.registerProvider(provider, isDefault);
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
    options?: string | NotificationSendServiceOptions,
  ): Promise<void> {
    const providerName = typeof options === "string" ? options : options?.providerName;
    const idempotencyKey = typeof options === "string" ? undefined : options?.idempotencyKey;
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

    const jobPayload: NotificationJobPayload = {
      ...payload,
      providerName: targetProviderName,
      ...(idempotencyKey === undefined ? {} : { idempotencyKey }),
    };

    await this.taskRunner.execute("send-notification", jobPayload);
  }
}
