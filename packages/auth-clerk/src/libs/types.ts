import type { IdempotencyStore } from "@croco/idempotency-core";

export type ClerkUserEvent = {
  id: string;
  email_addresses: Array<{ email_address: string; id?: string; verification?: { status: string } }>;
  first_name: string | null;
  last_name: string | null;
  primary_email_address_id?: string;
  created_at?: number;
  updated_at?: number;
  [key: string]: unknown;
};

export type ClerkOrgEvent = {
  id: string;
  name: string;
  slug: string;
  created_at?: number;
  updated_at?: number;
  [key: string]: unknown;
};

export type ClerkDeletedObjectEvent = {
  id: string;
  object?: string;
  deleted: boolean;
  [key: string]: unknown;
};

export type ClerkMembershipEvent = {
  id: string;
  organization: { id: string; name?: string };
  public_user_data: { user_id: string; first_name?: string | null; last_name?: string | null };
  role: string;
  created_at?: number;
  updated_at?: number;
  [key: string]: unknown;
};

export type WebhookEventType =
  | "user.created"
  | "user.updated"
  | "user.deleted"
  | "organization.created"
  | "organization.updated"
  | "organization.deleted"
  | "organizationMembership.created"
  | "organizationMembership.deleted";

type WebhookEventData = {
  "user.created": ClerkUserEvent;
  "user.updated": ClerkUserEvent;
  "user.deleted": ClerkDeletedObjectEvent;
  "organization.created": ClerkOrgEvent;
  "organization.updated": ClerkOrgEvent;
  "organization.deleted": ClerkDeletedObjectEvent;
  "organizationMembership.created": ClerkMembershipEvent;
  "organizationMembership.deleted": ClerkMembershipEvent;
};

export type WebhookHandlerOptions = {
  readonly signingSecret: string;
  readonly idempotencyStore: IdempotencyStore<ClerkWebhookDeliveryOutcome>;
  readonly idempotencyTtlMs?: number;
};

export type ClerkWebhookDeliveryOutcome = {
  readonly deliveryId: string;
  readonly eventType: string;
  readonly outcome: "handled" | "ignored";
};

export type WebhookEventHandler = {
  [K in WebhookEventType]?: (data: WebhookEventData[K]) => Promise<void>;
};

export type AuthorizationHeaderCarrier = {
  headers: {
    get(name: string): string | null;
  };
};
