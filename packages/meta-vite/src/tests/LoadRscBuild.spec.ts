import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { RSC_SERVER_ENTRY_VERSION, RSC_SSR_ENTRY_VERSION } from "../libs/rsc/buildEntry";
import {
  RSC_CLIENT_BUILD_FILE,
  RSC_FLIGHT_VERSION,
  composeRscClientManifestVersion,
} from "../libs/rsc/flight";
import { RscBuildInvalidProblem, loadRscBuild } from "../libs/rsc/loadRscBuild";

const CLIENT_ENTRY = "/assets/index-abc123.js";

type Layout = {
  readonly clientRecord?: unknown;
  readonly serverEntry?: string;
  readonly ssrEntry?: string;
  readonly clientEntryFile?: string | null;
};

const VALID_SERVER_ENTRY = `export default {
  version: ${JSON.stringify(RSC_SERVER_ENTRY_VERSION)},
  routes: [{ path: "/", head: () => ({ title: "Home" }) }],
  renderFlight: () => new ReadableStream(),
};`;

const VALID_SSR_ENTRY = `export default {
  version: ${JSON.stringify(RSC_SSR_ENTRY_VERSION)},
  clientEntryUrl: ${JSON.stringify(CLIENT_ENTRY)},
  renderHtml: async () => new ReadableStream(),
};`;

let outDir!: string;
let layoutCount = 0;

// Node caches ESM by URL, so every layout gets its own directory.
function writeLayout(layout: Layout = {}): string {
  const dir = join(outDir, `build-${layoutCount++}`);
  mkdirSync(join(dir, "client", "assets"), { recursive: true });
  mkdirSync(join(dir, "rsc"), { recursive: true });
  mkdirSync(join(dir, "ssr"), { recursive: true });

  const clientRecord =
    "clientRecord" in layout
      ? layout.clientRecord
      : {
          flightVersion: RSC_FLIGHT_VERSION,
          clientBuildId: "abc123",
          clientManifestVersion: composeRscClientManifestVersion("abc123"),
        };
  if (clientRecord !== null) {
    writeFileSync(join(dir, "client", RSC_CLIENT_BUILD_FILE), JSON.stringify(clientRecord));
  }
  if (layout.serverEntry !== "") {
    writeFileSync(join(dir, "rsc", "index.js"), layout.serverEntry ?? VALID_SERVER_ENTRY);
  }
  writeFileSync(join(dir, "ssr", "index.js"), layout.ssrEntry ?? VALID_SSR_ENTRY);
  const clientEntryFile =
    layout.clientEntryFile === undefined ? "index-abc123.js" : layout.clientEntryFile;
  if (clientEntryFile !== null) {
    writeFileSync(join(dir, "client", "assets", clientEntryFile), "export {};");
  }
  return dir;
}

async function expectInvalid(dir: string, reason: RegExp): Promise<void> {
  const failure = await loadRscBuild({ outDir: dir }).catch((error: unknown) => error);
  expect(failure).toBeInstanceOf(RscBuildInvalidProblem);
  expect((failure as RscBuildInvalidProblem).message).toMatch(reason);
}

describe("loadRscBuild", () => {
  beforeEach(() => {
    outDir = mkdtempSync(join(tmpdir(), "croco-rsc-build-"));
  });

  afterEach(() => {
    rmSync(outDir, { force: true, recursive: true });
  });

  it("loads the built entries and exposes one rsc route per declared route", async () => {
    const build = await loadRscBuild({ outDir: writeLayout() });

    expect(build.clientManifestVersion).toBe(composeRscClientManifestVersion("abc123"));
    expect(build.clientEntryUrl).toBe(CLIENT_ENTRY);
    expect(build.routes.map((route) => [route.path, route.mode, route.head?.()])).toEqual([
      ["/", "rsc", { title: "Home" }],
    ]);
  });

  it("refuses a build without the client build record", async () => {
    await expectInvalid(writeLayout({ clientRecord: null }), /client build record is missing/);
  });

  it("refuses a client build for another Flight protocol", async () => {
    await expectInvalid(
      writeLayout({
        clientRecord: {
          flightVersion: "croco.meta-vite.rsc-flight.v0",
          clientBuildId: "abc123",
          clientManifestVersion: composeRscClientManifestVersion("abc123"),
        },
      }),
      /Flight protocol/,
    );
  });

  it("refuses a client build record whose manifest version was edited", async () => {
    await expectInvalid(
      writeLayout({
        clientRecord: {
          flightVersion: RSC_FLIGHT_VERSION,
          clientBuildId: "abc123",
          clientManifestVersion: composeRscClientManifestVersion("other"),
        },
      }),
      /does not match clientBuildId/,
    );
  });

  it("refuses a missing rsc entry", async () => {
    await expectInvalid(writeLayout({ serverEntry: "" }), /built entry is missing/);
  });

  it("refuses an rsc entry that defineRscServerEntry did not create", async () => {
    await expectInvalid(
      writeLayout({ serverEntry: "export default async function handler() {}" }),
      /defineRscServerEntry/,
    );
  });

  it("refuses an ssr entry that defineRscSsrEntry did not create", async () => {
    await expectInvalid(
      writeLayout({ ssrEntry: "export async function renderHtml() {}" }),
      /defineRscSsrEntry/,
    );
  });

  it("refuses a client build that does not contain the client entry the ssr build expects", async () => {
    await expectInvalid(
      writeLayout({ clientEntryFile: "index-stale99.js" }),
      /rebuild client and server together/,
    );
  });
});
