import type { TenantResolver } from "../TenantResolver";

export type JwtRequest = {
  headers?: Record<string, string | string[] | undefined>;
};

type JwtPayload = Record<string, unknown>;

export type JwtClaimsResolver<TRequest extends JwtRequest = JwtRequest> = (
  request: TRequest,
) => Promise<JwtPayload | null> | JwtPayload | null;

export type JwtTenantResolverOptions<TRequest extends JwtRequest = JwtRequest> = {
  claimKey?: string;
  resolveVerifiedClaims?: JwtClaimsResolver<TRequest>;
};

function isJwtPayload(value: unknown): value is JwtPayload {
  return typeof value === "object" && value !== null;
}

export class JwtTenantResolver<
  TRequest extends JwtRequest = JwtRequest,
> implements TenantResolver<TRequest> {
  private readonly claimKey: string;
  private readonly resolveVerifiedClaims?: JwtClaimsResolver<TRequest>;

  constructor(config: string | JwtTenantResolverOptions<TRequest> = "tenant_id") {
    if (typeof config === "string") {
      this.claimKey = config;
      return;
    }

    this.claimKey = config.claimKey ?? "tenant_id";
    this.resolveVerifiedClaims = config.resolveVerifiedClaims;
  }

  async resolve(request: TRequest): Promise<string | null> {
    const payload = await this.resolvePayload(request);
    if (payload === null) {
      return null;
    }

    const tenantId = payload[this.claimKey];
    if (typeof tenantId !== "string") {
      return null;
    }

    return tenantId;
  }

  private async resolvePayload(request: TRequest): Promise<JwtPayload | null> {
    if (!this.resolveVerifiedClaims) {
      return null;
    }

    const claims = await this.resolveVerifiedClaims(request);
    if (!isJwtPayload(claims)) {
      return null;
    }

    return claims;
  }
}
