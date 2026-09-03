import {
  existsSync,
  linkSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { compileDesktopContractGraph, desktop } from "@croco/protocols-desktop";
import {
  createDesktopGeneratedArtifacts,
  inspectDesktopArtifactDrift,
  writeDesktopGeneratedArtifacts,
} from "../libs/desktopArtifacts.js";

const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("desktop generated artifacts", () => {
  it("writes the canonical graph, main metadata, preload bridge, and renderer client", () => {
    const outputDirectory = createTemporaryDirectory();
    const artifacts = createArtifacts();

    const result = writeDesktopGeneratedArtifacts(outputDirectory, artifacts);

    expect(result.removed).toEqual([]);
    expect(result.written).toEqual(artifacts.map(({ relativePath }) => relativePath).sort());
    expect(inspectDesktopArtifactDrift(outputDirectory, artifacts)).toEqual([]);
    for (const artifact of artifacts) {
      expect(readFileSync(join(outputDirectory, artifact.relativePath), "utf8")).toBe(
        artifact.content,
      );
    }
  });

  it("reports missing, modified, and stale managed files without changing them", () => {
    const outputDirectory = createTemporaryDirectory();
    const artifacts = createArtifacts();
    writeDesktopGeneratedArtifacts(outputDirectory, artifacts);
    const missing = artifacts.find(({ relativePath }) => relativePath.startsWith("preload/"));
    const modified = artifacts.find(({ relativePath }) => relativePath.startsWith("renderer/"));
    expect(missing).toBeDefined();
    expect(modified).toBeDefined();
    if (!missing || !modified) return;
    rmSync(join(outputDirectory, missing.relativePath));
    writeFileSync(join(outputDirectory, modified.relativePath), "modified\n");
    const stalePath = modified.relativePath.replace(/[a-f0-9]{64}/, "0".repeat(64));
    writeFileSync(join(outputDirectory, stalePath), "stale\n");

    const drift = inspectDesktopArtifactDrift(outputDirectory, artifacts);

    expect(drift.map(({ kind, relativePath }) => `${kind}:${relativePath}`)).toEqual([
      `missing:${missing.relativePath}`,
      `modified:${modified.relativePath}`,
      `stale:${stalePath}`,
    ]);
    expect(readFileSync(join(outputDirectory, modified.relativePath), "utf8")).toBe("modified\n");
    expect(readFileSync(join(outputDirectory, stalePath), "utf8")).toBe("stale\n");
  });

  it("removes only stale managed sources during regeneration", () => {
    const outputDirectory = createTemporaryDirectory();
    const artifacts = createArtifacts();
    writeDesktopGeneratedArtifacts(outputDirectory, artifacts);
    const source = artifacts.find(({ relativePath }) => relativePath.startsWith("renderer/"));
    expect(source).toBeDefined();
    if (!source) return;
    const stalePath = source.relativePath.replace(/[a-f0-9]{64}/, "f".repeat(64));
    const unmanagedPath = join(outputDirectory, "renderer", "handwritten.ts");
    writeFileSync(join(outputDirectory, stalePath), "stale\n");
    writeFileSync(unmanagedPath, "keep\n");

    const result = writeDesktopGeneratedArtifacts(outputDirectory, artifacts);

    expect(result.removed).toEqual([stalePath]);
    expect(existsSync(join(outputDirectory, stalePath))).toBe(false);
    expect(readFileSync(unmanagedPath, "utf8")).toBe("keep\n");
  });

  it.skipIf(process.platform === "win32")(
    "rejects symlinked output roots and managed targets before writing",
    () => {
      const parent = createTemporaryDirectory();
      const external = createTemporaryDirectory();
      const outputDirectory = join(parent, "generated");
      const externalGraph = join(external, "desktop-contract-graph.json");
      writeFileSync(externalGraph, "outside\n");
      symlinkSync(external, outputDirectory, "dir");

      expect(() => writeDesktopGeneratedArtifacts(outputDirectory, createArtifacts())).toThrow(
        expect.objectContaining({ code: "CROCO_DESKTOP_ARTIFACT_PATH_SYMLINK" }),
      );
      expect(readFileSync(externalGraph, "utf8")).toBe("outside\n");

      rmSync(outputDirectory);
      mkdirSync(outputDirectory);
      symlinkSync(externalGraph, join(outputDirectory, "desktop-contract-graph.json"));
      expect(() => inspectDesktopArtifactDrift(outputDirectory, createArtifacts())).toThrow(
        expect.objectContaining({ code: "CROCO_DESKTOP_ARTIFACT_PATH_SYMLINK" }),
      );
      expect(() => writeDesktopGeneratedArtifacts(outputDirectory, createArtifacts())).toThrow(
        expect.objectContaining({ code: "CROCO_DESKTOP_ARTIFACT_PATH_SYMLINK" }),
      );
      expect(readFileSync(externalGraph, "utf8")).toBe("outside\n");
    },
  );

  it("rejects a directory collision at a managed artifact path", () => {
    const outputDirectory = createTemporaryDirectory();
    const graphPath = join(outputDirectory, "desktop-contract-graph.json");
    mkdirSync(graphPath);

    expect(() => inspectDesktopArtifactDrift(outputDirectory, createArtifacts())).toThrow(
      expect.objectContaining({ code: "CROCO_DESKTOP_ARTIFACT_PATH_KIND_INVALID" }),
    );
    expect(() => writeDesktopGeneratedArtifacts(outputDirectory, createArtifacts())).toThrow(
      expect.objectContaining({ code: "CROCO_DESKTOP_ARTIFACT_PATH_KIND_INVALID" }),
    );
  });

  it("rejects hardlinked managed artifacts during reads and writes", () => {
    const outputDirectory = createTemporaryDirectory();
    const externalPath = join(createTemporaryDirectory(), "external graph.json");
    writeFileSync(externalPath, "outside\n");
    linkSync(externalPath, join(outputDirectory, "desktop-contract-graph.json"));

    expect(() => inspectDesktopArtifactDrift(outputDirectory, createArtifacts())).toThrow(
      expect.objectContaining({ code: "CROCO_DESKTOP_ARTIFACT_PATH_KIND_INVALID" }),
    );
    expect(() => writeDesktopGeneratedArtifacts(outputDirectory, createArtifacts())).toThrow(
      expect.objectContaining({ code: "CROCO_DESKTOP_ARTIFACT_PATH_KIND_INVALID" }),
    );
    expect(readFileSync(externalPath, "utf8")).toBe("outside\n");
  });
});

function createArtifacts() {
  const app = desktop.app({
    contracts: {},
    windows: { main: desktop.window.local() },
  });
  return createDesktopGeneratedArtifacts(compileDesktopContractGraph(app));
}

function createTemporaryDirectory(): string {
  const directory = mkdtempSync(join(tmpdir(), "croco-desktop-artifacts-"));
  temporaryDirectories.push(directory);
  return directory;
}
