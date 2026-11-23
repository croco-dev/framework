import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createRscAssetHandler } from "../libs/rsc/rscAssets";
import type { RscAssetHandler } from "../libs/rsc/rscAssets";

let clientDir!: string;
let handler!: RscAssetHandler;

describe("createRscAssetHandler", () => {
  beforeEach(() => {
    clientDir = mkdtempSync(join(tmpdir(), "croco-rsc-assets-"));
    mkdirSync(join(clientDir, "assets"));
    writeFileSync(join(clientDir, "assets", "index-abc.js"), "export const ok = 1;");
    writeFileSync(join(clientDir, "croco-rsc-client-build.json"), "{}");
    handler = createRscAssetHandler({ clientDir });
  });

  afterEach(() => {
    rmSync(clientDir, { force: true, recursive: true });
  });

  it("serves a hashed client asset as immutable JavaScript", async () => {
    const request = new Request("http://localhost/assets/index-abc.js");

    expect(handler.match(request)).toBe(true);
    const response = await handler.handle(request);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("text/javascript; charset=utf-8");
    expect(response.headers.get("cache-control")).toBe("public, max-age=31536000, immutable");
    expect(await response.text()).toBe("export const ok = 1;");
  });

  it("does not claim page requests or non-read methods", () => {
    expect(handler.match(new Request("http://localhost/"))).toBe(false);
    expect(
      handler.match(new Request("http://localhost/assets/index-abc.js", { method: "POST" })),
    ).toBe(false);
  });

  it("answers 404 for a missing asset", async () => {
    const response = await handler.handle(new Request("http://localhost/assets/missing.js"));

    expect(response.status).toBe(404);
  });

  it("refuses encoded traversal out of the assets directory", async () => {
    const response = await handler.handle(
      new Request("http://localhost/assets/%2e%2e/croco-rsc-client-build.json"),
    );

    expect(response.status).toBe(404);
  });
});
