import type { TenantResolver } from "../TenantResolver";

export type HeaderRequest = {
  headers?: Record<string, string | string[] | undefined>;
};

export type HeaderTenantResolverOptions = {
  headerName?: string;
  required?: boolean;
};

export class HeaderTenantResolver implements TenantResolver<HeaderRequest> {
  private readonly headerName: string;
  private readonly required: boolean;

  constructor(options: HeaderTenantResolverOptions = {}) {
    this.headerName = options.headerName ?? "x-tenant-id";
    this.required = options.required ?? false;
  }

  async resolve(request: HeaderRequest): Promise<string | null> {
    const headerValue = request.headers?.[this.headerName];
    if (!headerValue) {
      return null;
    }
    const value = Array.isArray(headerValue) ? headerValue[0] : headerValue;
    return value ?? null;
  }
}
