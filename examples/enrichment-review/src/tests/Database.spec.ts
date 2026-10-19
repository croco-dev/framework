import { afterEach, describe, expect, it, vi } from "vitest";
import { EnrichmentProblem } from "@croco/analytics-core/enrichment";
import { database } from "../database";

afterEach(() => vi.unstubAllEnvs());

describe("synthetic enrichment database boundary", () => {
  it.each([
    "postgres://localhost/example?host=remote.example",
    "postgres://localhost/example?%68ost=remote.example",
    "postgres://127.0.0.1/example?hostaddr=192.0.2.1",
    "postgres://remote.example/example",
    "mysql://localhost/example",
    "invalid connection string",
    undefined,
  ])("rejects an unsafe connection string before creating a pool: %s", (connectionString) => {
    vi.stubEnv("ENRICHMENT_POSTGRES_URL", connectionString);
    expect(database).toThrowError(
      expect.objectContaining({ code: "analytics-core/enrichment-local-database-required" }),
    );
  });

  it("keeps an invalid URL cause private", () => {
    vi.stubEnv("ENRICHMENT_POSTGRES_URL", "postgresql://user:private-password@[");
    try {
      database();
      expect.fail("An invalid URL must be rejected");
    } catch (error) {
      expect(error).toBeInstanceOf(EnrichmentProblem);
      if (!(error instanceof EnrichmentProblem)) throw error;
      expect(error.cause).toBeInstanceOf(TypeError);
      expect(JSON.stringify(error.toJSON())).not.toContain("private-password");
    }
  });
  it.each(["127.0.0.1", "localhost", "[::1]"])(
    "accepts a PostgreSQL loopback host: %s",
    async (host) => {
      vi.stubEnv("ENRICHMENT_POSTGRES_URL", `postgresql://${host}/synthetic`);
      const { pool } = database();
      await pool.end();
    },
  );
});
