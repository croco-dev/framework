import type { TenantResolver } from "../TenantResolver";

export type SubdomainRequest = {
  url?: string;
};

export type SubdomainTenantResolverOptions = {
  domainSuffix?: string;
  required?: boolean;
};

export class SubdomainTenantResolver implements TenantResolver<SubdomainRequest> {
  private readonly domainSuffix: string | undefined;
  private readonly required: boolean;

  constructor(options: SubdomainTenantResolverOptions = {}) {
    this.domainSuffix = options.domainSuffix;
    this.required = options.required ?? false;
  }

  async resolve(request: SubdomainRequest): Promise<string | null> {
    const url = request.url;
    if (!url) {
      return null;
    }

    try {
      const hostname = new URL(url).hostname;
      const parts = hostname.split(".");

      if (this.domainSuffix) {
        const suffix = this.domainSuffix.startsWith(".")
          ? this.domainSuffix
          : `.${this.domainSuffix}`;
        if (!hostname.endsWith(suffix)) {
          return null;
        }
        const suffixParts = suffix.split(".").filter(Boolean).length;
        if (parts.length <= suffixParts) {
          return null;
        }
        return parts.slice(0, parts.length - suffixParts).join(".");
      }

      if (parts.length < 3) {
        return null;
      }

      return parts[0];
    } catch {
      return null;
    }
  }
}
