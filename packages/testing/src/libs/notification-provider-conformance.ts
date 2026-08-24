import * as assert from "node:assert/strict";

export type NotificationProviderOutboxIntegrationContract =
  | "consumer-managed"
  | "provider-managed"
  | "unsupported";

export type NotificationProviderCapabilityContract<TChannel extends string> = {
  readonly providerName: string;
  readonly channels: readonly TChannel[];
  readonly supportsIdempotencyKey: boolean;
  readonly supportsProviderTemplates: boolean;
  readonly supportsRenderedTemplates: boolean;
  readonly outboxIntegration: NotificationProviderOutboxIntegrationContract;
};

export type NotificationProviderConformanceSubject<TChannel extends string> = {
  getName(): string;
  getChannel(): TChannel;
  getCapabilities(): NotificationProviderCapabilityContract<TChannel>;
};

export type NotificationProviderConformanceCase = {
  readonly name: string;
  run(): Promise<void>;
};

export type NotificationProviderConformanceOptions<TChannel extends string> = {
  readonly createProvider: () =>
    | NotificationProviderConformanceSubject<TChannel>
    | Promise<NotificationProviderConformanceSubject<TChannel>>;
  readonly expectedCapabilities: NotificationProviderCapabilityContract<TChannel>;
};

export type NotificationProviderConformanceSuite = {
  readonly cases: readonly NotificationProviderConformanceCase[];
};

const OUTBOX_INTEGRATIONS = new Set<NotificationProviderOutboxIntegrationContract>([
  "consumer-managed",
  "provider-managed",
  "unsupported",
]);

export function createNotificationProviderConformanceSuite<TChannel extends string>(
  options: NotificationProviderConformanceOptions<TChannel>,
): NotificationProviderConformanceSuite {
  const createProvider = async (): Promise<NotificationProviderConformanceSubject<TChannel>> =>
    await options.createProvider();

  return {
    cases: [
      {
        name: "exposes a complete explicit notification capability profile",
        run: async () => {
          const provider = await createProvider();
          const capabilities = provider.getCapabilities();

          assert.deepEqual(capabilities, options.expectedCapabilities);
          assert.equal(typeof capabilities.supportsIdempotencyKey, "boolean");
          assert.equal(typeof capabilities.supportsProviderTemplates, "boolean");
          assert.equal(typeof capabilities.supportsRenderedTemplates, "boolean");
          assert.equal(OUTBOX_INTEGRATIONS.has(capabilities.outboxIntegration), true);
        },
      },
      {
        name: "aligns notification capability identity with the provider contract",
        run: async () => {
          const provider = await createProvider();
          const capabilities = provider.getCapabilities();

          assert.equal(capabilities.providerName, provider.getName());
          assert.equal(capabilities.channels.includes(provider.getChannel()), true);
        },
      },
      {
        name: "returns a stable notification capability profile across reads",
        run: async () => {
          const provider = await createProvider();

          assert.deepEqual(provider.getCapabilities(), provider.getCapabilities());
        },
      },
    ],
  };
}
