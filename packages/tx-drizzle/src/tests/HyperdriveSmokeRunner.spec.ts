import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { runHyperdriveSmoke, validateSmokeOptions } from "../../smoke/verify.mts";
import { readSmokeBody } from "../../smoke/protocol.mts";

const valid = {
  url: "http://127.0.0.1:1234",
  target: "local" as const,
  token: "smoke-test-token-with-at-least-32-characters",
  databaseUrl: "postgres://observer:private-password@127.0.0.1:1/smoke",
};

describe("Hyperdrive smoke runner", () => {
  it.each([
    { url: "http://example.com" },
    { url: "http://127.0.0.1.evil.test" },
    { url: "https://private-user:private-password@worker.example.com", target: "remote" as const },
    { url: "https://worker.example.com/?token=private-token", target: "remote" as const },
    { url: "http://worker.example.com", target: "remote" as const },
    { url: "http://127.0.0.1:1234/other" },
    { token: "" },
    { databaseUrl: "" },
    { databaseUrl: "https://observer.example.com" },
  ])("rejects unsafe or incomplete configuration without leaking it: %j", async (override) => {
    const report = await runHyperdriveSmoke({ ...valid, ...override });
    expect(report.status).toBe("failed");
    expect(report.checks[0]).toEqual({ name: "configuration", status: "failed" });
    expect(report.checks.find(({ name }) => name === "claim")?.status).toBe("not-run");
    expect(JSON.stringify(report)).not.toMatch(/private-|postgres:|smoke-test-token/);
    expect(report.cloudflareDeployment).toBe("not-verified");
  });

  it("accepts explicit remote HTTPS without treating it as Cloudflare attestation", () => {
    expect(
      validateSmokeOptions({ ...valid, url: "https://worker.example.com", target: "remote" })
        .origin,
    ).toBe("https://worker.example.com");
  });

  it("writes a safe failed CLI report and exits nonzero for invalid configuration", () => {
    const directory = mkdtempSync(resolve(tmpdir(), "croco-smoke-invalid-"));
    try {
      const output = resolve(directory, "report.json");
      const result = spawnSync(
        process.execPath,
        [
          "--experimental-strip-types",
          resolve(import.meta.dirname, "../../smoke/verify.mts"),
          "--url",
          "http://example.com",
          "--target",
          "local",
          "--output",
          output,
        ],
        {
          env: {
            ...process.env,
            HYPERDRIVE_SMOKE_TOKEN: valid.token,
            HYPERDRIVE_SMOKE_DATABASE_URL: valid.databaseUrl,
          },
          encoding: "utf8",
          timeout: 10_000,
        },
      );
      expect(result.status).toBe(1);
      const report = JSON.parse(readFileSync(output, "utf8"));
      expect(report.status).toBe("failed");
      expect(`${result.stdout}${result.stderr}${JSON.stringify(report)}`).not.toMatch(
        /private-password|smoke-test-token/,
      );
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("cancels oversized streams before consuming their remaining content", async () => {
    let cancelled = false;
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode("あ"));
        controller.enqueue(new TextEncoder().encode("secret-must-not-be-read"));
      },
      cancel() {
        cancelled = true;
      },
    });
    expect(await readSmokeBody(stream, 2)).toBeUndefined();
    expect(cancelled).toBe(true);
    expect(await readSmokeBody(new Response("small").body, 5)).toBe("small");
  });

  it("cancels a stalled body at its deadline rather than accepting partial JSON", async () => {
    const controller = new AbortController();
    let cancelled = false;
    const stream = new ReadableStream<Uint8Array>({
      start(writer) {
        writer.enqueue(new TextEncoder().encode("{}"));
      },
      cancel() {
        cancelled = true;
      },
    });
    const reading = readSmokeBody(stream, 512, controller.signal);
    controller.abort();
    expect(await reading).toBeUndefined();
    expect(cancelled).toBe(true);
  });
});
