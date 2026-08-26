import { Problem, ProblemCategory } from "@croco/problems-core";
import { describe, expect, it, vi } from "vitest";
import { MeilisearchDiagnosticsProvider } from "../libs/MeilisearchDiagnosticsProvider";

const SECRET_SAMPLE = "super-secret-token";

class TestMeilisearchDiagnosticProblem extends Problem {
  constructor() {
    super(
      "search-meilisearch/tenant-token-not-configured",
      ProblemCategory.InternalServerError,
      "Tenant token options are not configured",
      {
        extensions: {
          accessKey: SECRET_SAMPLE,
          apiKey: SECRET_SAMPLE,
          cookie: SECRET_SAMPLE,
          endpoint: `https://search.example?apiKey=${SECRET_SAMPLE}`,
          nested: {
            access_token: SECRET_SAMPLE,
            token: SECRET_SAMPLE,
          },
          provider: "meilisearch",
        },
      },
    );
  }
}

const mocks = vi.hoisted(() => {
  const client = {
    health: vi.fn(),
  };
  const constructor = vi.fn();
  return { clientMock: client, constructorMock: constructor };
});

vi.mock("meilisearch", () => ({
  MeiliSearch: class {
    constructor(options: unknown) {
      mocks.constructorMock(options);
      Object.assign(this, mocks.clientMock);
    }
  },
}));

describe("MeilisearchDiagnosticsProvider", () => {
  it("reports missing config without leaking raw values", async () => {
    const diagnostics = new MeilisearchDiagnosticsProvider({
      apiKey: SECRET_SAMPLE,
      host: "",
    });

    const health = await diagnostics.getHealth();
    const serialized = JSON.stringify(health);

    expect(health).toMatchObject({
      component: "search-meilisearch",
      details: expect.objectContaining({
        hasApiKey: true,
        hasHost: false,
        liveCheck: "not_started",
        problemCode: "search-meilisearch/missing-config",
      }),
      status: "unhealthy",
    });
    expect(serialized).not.toContain(SECRET_SAMPLE);
  });

  it("reports healthy config when live readiness is not configured", async () => {
    const diagnostics = new MeilisearchDiagnosticsProvider({
      apiKey: SECRET_SAMPLE,
      host: "http://localhost:7700",
    });

    const health = await diagnostics.getHealth();

    expect(health).toMatchObject({
      component: "search-meilisearch",
      details: expect.objectContaining({
        hasApiKey: true,
        hasHost: true,
        liveCheck: "not_configured",
      }),
      status: "healthy",
    });
  });

  it("runs readiness checks and redacts returned diagnostic details", async () => {
    const diagnostics = new MeilisearchDiagnosticsProvider(
      {
        apiKey: SECRET_SAMPLE,
        host: "http://localhost:7700",
      },
      {
        readinessCheck: async ({ client }) => {
          expect(client.health).toBe(mocks.clientMock.health);
          return {
            message: `Authorization: Bearer ${SECRET_SAMPLE}; access_token=${SECRET_SAMPLE}; Cookie: session=${SECRET_SAMPLE}`,
            details: {
              accessKey: SECRET_SAMPLE,
              apiKey: SECRET_SAMPLE,
              cookie: SECRET_SAMPLE,
              endpoint: `https://search.example?apiKey=${SECRET_SAMPLE}`,
              nested: {
                access_token: SECRET_SAMPLE,
                token: SECRET_SAMPLE,
              },
              reachable: true,
            },
          };
        },
      },
    );

    const health = await diagnostics.getHealth();
    const serialized = JSON.stringify(health);

    expect(health).toMatchObject({
      component: "search-meilisearch",
      message: "Authorization: [redacted]; access_token=[redacted]; Cookie: [redacted]",
      details: expect.objectContaining({
        liveCheck: "passed",
        readiness: {
          accessKey: "[redacted]",
          apiKey: "[redacted]",
          cookie: "[redacted]",
          endpoint: "https://search.example?apiKey=[redacted]",
          nested: {
            access_token: "[redacted]",
            token: "[redacted]",
          },
          reachable: true,
        },
      }),
      status: "healthy",
    });
    expect(serialized).not.toContain(SECRET_SAMPLE);
  });

  it("redacts sensitive extensions from readiness Problems before returning health details", async () => {
    const diagnostics = new MeilisearchDiagnosticsProvider(
      {
        apiKey: SECRET_SAMPLE,
        host: "http://localhost:7700",
      },
      {
        readinessCheck: async () => {
          throw new TestMeilisearchDiagnosticProblem();
        },
      },
    );

    const health = await diagnostics.getHealth();
    const serialized = JSON.stringify(health);

    expect(health).toMatchObject({
      component: "search-meilisearch",
      details: expect.objectContaining({
        accessKey: "[redacted]",
        apiKey: "[redacted]",
        cookie: "[redacted]",
        endpoint: "https://search.example?apiKey=[redacted]",
        liveCheck: "failed",
        nested: {
          access_token: "[redacted]",
          token: "[redacted]",
        },
        problemCode: "search-meilisearch/tenant-token-not-configured",
      }),
      status: "degraded",
    });
    expect(serialized).not.toContain(SECRET_SAMPLE);
  });

  it("normalizes readiness failures as redacted upstream Problems", async () => {
    const diagnostics = new MeilisearchDiagnosticsProvider(
      {
        apiKey: SECRET_SAMPLE,
        host: "http://localhost:7700",
      },
      {
        readinessCheck: async () => {
          const error = new Error(`Authorization: Bearer ${SECRET_SAMPLE}`);
          Object.assign(error, { response: { status: 503 } });
          throw error;
        },
      },
    );

    const health = await diagnostics.getHealth();
    const serialized = JSON.stringify(health);

    expect(health).toMatchObject({
      component: "search-meilisearch",
      details: expect.objectContaining({
        liveCheck: "failed",
        problemCode: "search-meilisearch/retryable-upstream",
        retryable: true,
        upstreamStatus: 503,
      }),
      status: "degraded",
    });
    expect(serialized).not.toContain(SECRET_SAMPLE);
  });
});
