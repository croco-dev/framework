import { ContactPolicyOperations, assertContactPolicyRegistration } from "@croco/admin-core";
import type {
  ContactPolicyAdminAccess,
  ContactPolicyAdminRegistration,
  ContactPolicyAdminScope,
  ContactPolicyAdminStore,
} from "@croco/admin-core";
import {
  ContactPolicy,
  type ContactPolicyScope,
  type EngagementContactPolicyGate,
} from "@croco/engagement-core";
import {
  DrizzleContactPolicyAdminStore,
  DrizzleContactPolicyStore,
  type DrizzleContactPolicyAdminClient,
  type DrizzleContactPolicyClient,
} from "@croco/engagement-drizzle";

/** Compose a durable contact gate and authorized console operations on the server. */
export function createContactPolicyHost(options: {
  ledgerDb: DrizzleContactPolicyClient;
  settingsDb: DrizzleContactPolicyAdminClient;
  registration: ContactPolicyAdminRegistration;
  app: string;
  environment: string;
  fingerprint(value: unknown): string;
  authorize(
    target: ContactPolicyAdminScope,
    permission: "contact-policy.read" | "contact-policy.write",
  ): Promise<ContactPolicyAdminAccess>;
}) {
  const ledger = new DrizzleContactPolicyStore(options.ledgerDb);
  const settingsStore = new DrizzleContactPolicyAdminStore(options.settingsDb);
  const settings: ContactPolicyAdminStore = settingsStore;
  const createPolicy = (snapshot: {
    config: ContactPolicyAdminRegistration["config"];
    topics: ContactPolicyAdminRegistration["topics"];
  }) => new ContactPolicy({ store: ledger, config: snapshot.config, topics: snapshot.topics });
  const admin = new ContactPolicyOperations({
    store: settings,
    registration: options.registration,
    authorize: options.authorize,
    createPolicy,
  });
  const gate: EngagementContactPolicyGate = {
    app: options.app,
    environment: options.environment,
    fingerprint: options.fingerprint,
    resolvePolicy: async (scope: ContactPolicyScope) => {
      const current = await settingsStore.loadPolicy(scope);
      if (current) assertContactPolicyRegistration(current, options.registration);
      return createPolicy(
        current ?? { config: options.registration.config, topics: options.registration.topics },
      );
    },
  };
  return { admin, gate };
}
