export type TenantTokenOptions = {
  apiKeyUid: string;
  expiresIn?: number; // seconds
};

export type MeilisearchEngineOptions = {
  host: string;
  apiKey: string;
  tenantTokenOptions?: TenantTokenOptions;
};
