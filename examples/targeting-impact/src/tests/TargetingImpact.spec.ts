import { describe, expect, it } from "vitest";
import { createPolicyReplayReport } from "@croco/metrics-core";
import { createFixture, fixtureInput, scope } from "../fixture";
import { createDemoServer } from "../http";

describe("targeting impact synthetic example", () => {
  it("replays an actual complete campaign store and round-trips immutable reports", async () => {
    const fixture = await createFixture("ready");
    const result = await fixture.compare("preserve");
    expect(result.status).toBe("available");
    expect(result.report?.result).toMatchObject({
      baselineN: 100,
      excludedN: 20,
      observedCostSaved: { amount: 200 },
      observedVisits: { preSendN: 100, postClickN: 50, postSendNonClickN: 50 },
    });
    const saved = await fixture.service.save(fixtureInput("ready", "preserve"));
    expect(await fixture.service.load(scope, saved.inputHash)).toEqual(saved);
    expect(JSON.parse(await fixture.service.export(scope, saved.inputHash))).toEqual(saved);
    expect(saved.input).not.toHaveProperty("rows");
    await expect(
      fixture.service.load({ ...scope, tenantId: "foreign" }, saved.inputHash),
    ).rejects.toThrow();
    await expect(
      fixture.service.replay({ ...fixtureInput("ready", "preserve"), currency: "USD" }),
    ).rejects.toThrow();
    expect((await fixture.compare("exclude")).report?.definitionHash).not.toBe(
      saved.definitionHash,
    );
  });
  it("deduplicates financial events repeated across observed messages", async () => {
    const input = fixtureInput("ready", "preserve");
    const row = input.rows[0];
    if (!row) throw new TypeError("Missing fixture row");
    const report = await createPolicyReplayReport({
      ...input,
      rows: [
        row,
        { ...row, dispatch: { dispatchId: "second-message", at: "2026-09-01T02:30:00.000Z" } },
      ],
    });
    expect(report.result.scenarioValues.map((value) => value.excludedFinancialEventN)).toEqual([
      1, 1,
    ]);
    expect(report.result.scenarioValues.map((value) => value.excludedObservedRevenue)).toEqual([
      1000, 1000,
    ]);
  });
  it("preserves unknown history and reports unavailable evidence", async () => {
    const partial = await createFixture("partial");
    expect((await partial.compare("preserve")).report?.result).toMatchObject({
      unknownN: 10,
      effectiveExcludedN: 20,
      observedCostSaved: { status: "partial" },
    });
    expect((await partial.compare("exclude")).report?.result.effectiveExcludedN).toBe(30);
    expect((await (await createFixture("unavailable")).compare("preserve")).status).toBe(
      "unavailable",
    );
    await expect((await createFixture("denied")).compare("preserve")).rejects.toThrow();
  });
  it("rejects HTTP authority injection, malformed JSON and oversized bodies", async () => {
    const server = await createDemoServer(process.cwd());
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new TypeError("Missing server address");
    const post = (path: string, body: string) =>
      fetch(`http://127.0.0.1:${address.port}${path}`, { method: "POST", body });
    try {
      expect(
        (await post("/save?state=unavailable", JSON.stringify({ unknownPolicy: "preserve" })))
          .status,
      ).toBe(422);
      expect((await post("/compare", "{")).status).toBe(422);
      expect(
        (
          await post(
            "/compare",
            JSON.stringify({ unknownPolicy: "preserve", scope: { tenantId: "foreign" } }),
          )
        ).status,
      ).toBe(422);
      expect(
        (await post("/compare?state=denied", JSON.stringify({ unknownPolicy: "preserve" }))).status,
      ).toBe(403);
      expect((await post("/compare", "x".repeat(4097))).status).toBe(413);
      const savedResponse = await post("/save", JSON.stringify({ unknownPolicy: "preserve" }));
      expect(savedResponse.status).toBe(200);
      const saved = await savedResponse.json();
      expect(await (await post("/get", JSON.stringify({ id: saved.inputHash }))).json()).toEqual(
        saved,
      );
    } finally {
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    }
  });
});
