export type AuthGuardConformanceProblem = {
  readonly status: number;
  readonly code: string;
};

export type AuthGuardConformanceSubject = {
  readonly id: string;
  readonly email: string;
  readonly roles: readonly string[];
  readonly scopes: readonly string[];
  readonly permissions: readonly string[];
  readonly tenantId: string;
  readonly metadata: {
    readonly tenantId: string;
    readonly scopes: readonly string[];
  };
};

export type RouteMetadataAdapterFixture = {
  readonly adapter: "REST" | "GraphQL" | "custom";
  readonly context: {
    getClass(): unknown;
    getFieldName?(): string | symbol;
    getHandler(): string | symbol;
    getMethod?(): string;
    getPath?(): string;
    getRequest(): unknown;
  };
};

const roles = ["admin", "operator"] as const;
const scopes = ["widgets:read", "widgets:write"] as const;
const tenantId = "tenant-auth-conformance";

export const authGuardConformance = {
  tokens: {
    valid: "conformance-valid-token",
    invalid: "conformance-invalid-token",
    verifierUnavailable: "conformance-verifier-unavailable-token",
  },
  headers: {
    validAuthorization: "Bearer conformance-valid-token",
    invalidAuthorization: "Bearer conformance-invalid-token",
    verifierUnavailableAuthorization: "Bearer conformance-verifier-unavailable-token",
    malformedAuthorization: "conformance-valid-token",
    wrongSchemeAuthorization: "Basic conformance-valid-token",
  },
  subject: {
    id: "user-auth-conformance",
    email: "auth-conformance@example.test",
    roles,
    scopes,
    permissions: scopes,
    tenantId,
    metadata: {
      tenantId,
      scopes,
    },
  } satisfies AuthGuardConformanceSubject,
  authCore: {
    missingCredentials: {
      status: 401,
      code: "UNAUTHORIZED",
    },
    invalidCredentials: {
      status: 401,
      code: "UNAUTHORIZED",
    },
    providerUnavailable: {
      status: 500,
      code: "auth-core/auth-provider-unavailable",
    },
  } satisfies Record<string, AuthGuardConformanceProblem>,
  preservedProblem: {
    policyDenied: {
      status: 403,
      code: "ACCESS_DENIED",
    },
  } satisfies Record<string, AuthGuardConformanceProblem>,
  invalidRouteMetadataTargets: [
    { name: "undefined", value: undefined },
    { name: "null", value: null },
    { name: "string", value: "TestController" },
    { name: "number", value: 42 },
    { name: "boolean", value: true },
  ],
  rest: {
    missingCredentials: {
      status: 401,
      code: "protocols-rest/auth-missing-header",
    },
    malformedCredentials: {
      status: 400,
      code: "protocols-rest/auth-invalid-header-format",
    },
    invalidCredentials: {
      status: 401,
      code: "protocols-rest/auth-invalid-token",
    },
    verifierUnavailable: {
      status: 500,
      code: "protocols-rest/auth-verifier-unavailable",
    },
  } satisfies Record<string, AuthGuardConformanceProblem>,
  graphql: {
    missingCredentials: {
      status: 401,
      code: "protocols-graphql/auth-missing-header",
    },
    malformedCredentials: {
      status: 400,
      code: "protocols-graphql/auth-invalid-header-format",
    },
    invalidCredentials: {
      status: 401,
      code: "protocols-graphql/auth-invalid-token",
    },
    verifierUnavailable: {
      status: 500,
      code: "protocols-graphql/auth-verifier-unavailable",
    },
  } satisfies Record<string, AuthGuardConformanceProblem>,
} as const;

export function createRouteMetadataAdapterFixtures(
  target: unknown,
  request: unknown,
  handler: string | symbol = "protectedMethod",
): readonly RouteMetadataAdapterFixture[] {
  return [
    {
      adapter: "REST",
      context: {
        getClass: () => target,
        getHandler: () => handler,
        getRequest: () => request,
        getPath: () => "/test",
        getMethod: () => "GET",
      },
    },
    {
      adapter: "GraphQL",
      context: {
        getClass: () => target,
        getHandler: () => handler,
        getRequest: () => request,
        getFieldName: () => handler,
      },
    },
    {
      adapter: "custom",
      context: {
        getClass: () => target,
        getHandler: () => handler,
        getRequest: () => request,
      },
    },
  ];
}

function mutableCopy(values: readonly string[]): string[] {
  return [...values];
}

export function createConformanceAuthCoreUser() {
  return {
    id: authGuardConformance.subject.id,
    email: authGuardConformance.subject.email,
    roles: mutableCopy(authGuardConformance.subject.roles),
    permissions: mutableCopy(authGuardConformance.subject.permissions),
    tenantId: authGuardConformance.subject.tenantId,
    metadata: {
      tenantId: authGuardConformance.subject.metadata.tenantId,
      scopes: mutableCopy(authGuardConformance.subject.metadata.scopes),
    },
  };
}

export function createConformanceProtocolUser() {
  return {
    ...createConformanceAuthCoreUser(),
    scopes: mutableCopy(authGuardConformance.subject.scopes),
  };
}

export function createConformanceApiKeyPrincipal() {
  return {
    type: "apikey" as const,
    id: "api-key-auth-conformance",
    keyId: "kid_auth_conformance",
    name: "Auth conformance API key",
    keyStart: "pk_conf_",
    permissions: mutableCopy(authGuardConformance.subject.permissions),
    tenantId: authGuardConformance.subject.tenantId,
    metadata: {
      scopes: mutableCopy(authGuardConformance.subject.scopes),
    },
  };
}
