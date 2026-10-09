import {
  BillingCancellationAction,
  BillingService,
  CancellationService,
} from "@croco/billing-core";
import { DrizzleBillingStore, DrizzleCancellationStore } from "@croco/billing-drizzle";
import { RetentionOfferOperations } from "@croco/admin-core";
import type {
  BillingGateway,
  CancellationAuthority,
  CancellationScope,
  CheckoutResult,
  RegisteredCancellationChoice,
} from "@croco/billing-core";
import type { IdempotencyStore } from "@croco/idempotency-core";

export const registeredChoices: readonly RegisteredCancellationChoice[] = [
  {
    id: "resume",
    action: "resume",
    label: "Resume subscription",
    consequence: "Remove the scheduled cancellation and continue the current subscription.",
  },
  {
    id: "lower-plan",
    action: "change-plan",
    label: "Change to a lower plan",
    consequence: "Change your plan only when your provider supports this registered action.",
  },
];

/** The app supplies authenticated ownership, authoritative quotes and serialized admission. */
export function createCancellationExample(
  options: Readonly<{
    database: ConstructorParameters<typeof DrizzleBillingStore>[0];
    scope: CancellationScope;
    gateway: BillingGateway;
    checkoutIdempotencyStore: IdempotencyStore<CheckoutResult>;
    authority: CancellationAuthority;
    actor(): Promise<string>;
  }>,
) {
  const billingStore = new DrizzleBillingStore(options.database, options.scope);
  const store = new DrizzleCancellationStore(options.database);
  const billing = new BillingService({
    store: billingStore,
    gateway: options.gateway,
    checkoutIdempotencyStore: options.checkoutIdempotencyStore,
  });
  const service = new CancellationService({
    store,
    authority: options.authority,
    choices: registeredChoices,
    actions: (["cancel", "resume"] as const).map(
      (kind) =>
        new BillingCancellationAction(
          kind,
          options.scope,
          billing,
          billingStore,
          options.authority,
        ),
    ),
  });
  const operations = new RetentionOfferOperations({
    service,
    store,
    registration: registeredChoices,
    actor: options.actor,
    now: () => new Date(),
  });
  return { billingStore, store, billing, service, operations };
}
