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
    this.headerName = (options.headerName ?? "x-tenant-id").toLowerCase();
    this.required = options.required ?? false;
  }

  async resolve(request: HeaderRequest): Promise<string | null> {
    const headers = request.headers;
    if (!headers) {
      return null;
    }
    const matchingKeys = Object.getOwnPropertyNames(headers).filter(
      (key) => key.toLowerCase() === this.headerName,
    );
    // Duplicate field names are ambiguous even when their current values agree.
    if (matchingKeys.length !== 1) {
      return null;
    }
    const headerValue = headers[matchingKeys[0]];
    if (!headerValue) {
      return null;
    }
    const value = Array.isArray(headerValue) ? headerValue[0] : headerValue;
    return value ?? null;
  }
}
