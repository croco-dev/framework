export type ClerkUserEvent = {
  id: string;
  email_addresses: Array<{ email_address: string }>;
  first_name: string | null;
  last_name: string | null;
  [key: string]: unknown;
};

export type ClerkOrgEvent = {
  id: string;
  name: string;
  slug: string;
  [key: string]: unknown;
};

export type ClerkMembershipEvent = {
  id: string;
  organization: { id: string };
  public_user_data: { user_id: string };
  role: string;
  [key: string]: unknown;
};

export type WebhookHandlerOptions = {
  signingSecret: string;
};

export type WebhookEventHandler = {
  'user.created'?: (data: ClerkUserEvent) => Promise<void>;
  'user.updated'?: (data: ClerkUserEvent) => Promise<void>;
  'user.deleted'?: (data: ClerkUserEvent) => Promise<void>;
  'organization.created'?: (data: ClerkOrgEvent) => Promise<void>;
  'organization.updated'?: (data: ClerkOrgEvent) => Promise<void>;
  'organization.deleted'?: (data: ClerkOrgEvent) => Promise<void>;
  'organizationMembership.created'?: (data: ClerkMembershipEvent) => Promise<void>;
  'organizationMembership.deleted'?: (data: ClerkMembershipEvent) => Promise<void>;
};
