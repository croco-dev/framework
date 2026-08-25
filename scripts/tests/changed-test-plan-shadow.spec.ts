import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import {
  assertExecutableAssuranceGraph,
  createExecutableAssuranceGraph,
} from "../../packages/testing/src/executable-assurance.ts";
import {
  createShadowAssuranceGraph,
  parseChangedTestShadowArgs,
  readJsonFile,
  readJsonAtRevision,
} from "../changed-test-plan-shadow.mts";

const ROOT = resolve(__dirname, "../..");

describe("changed-test-plan-shadow", () => {
  it("uses a documented zero-miss observation window", () => {
    expect(
      parseChangedTestShadowArgs([
        "--base",
        "origin/trunk",
        "--full-evidence",
        "ci-reports/full/bundle.json",
      ]),
    ).toEqual({
      base: "origin/trunk",
      head: "HEAD",
      fullEvidence: "ci-reports/full/bundle.json",
      outputDirectory: "ci-reports/changed-test-plan",
      observationWindow: 20,
      missThreshold: 0,
      executeSelected: false,
    });
  });

  it("enables advisory selected-plan execution explicitly", () => {
    expect(
      parseChangedTestShadowArgs([
        "--base",
        "origin/trunk",
        "--full-evidence",
        "bundle.json",
        "--execute-selected",
      ]).executeSelected,
    ).toBe(true);
  });

  it("rejects missing evidence and unsafe observation policy values", () => {
    expect(() => parseChangedTestShadowArgs(["--base", "origin/trunk"])).toThrow(
      "--full-evidence requires a test evidence bundle",
    );
    expect(() =>
      parseChangedTestShadowArgs([
        "--base",
        "origin/trunk",
        "--full-evidence",
        "bundle.json",
        "--miss-threshold",
        "2",
      ]),
    ).toThrow("Miss threshold must be from 0 through 1");
  });

  it("compiles every applicable assurance artifact into the shadow graph", () => {
    const artifacts = new Map<string, unknown>([
      [
        "contract-graph.snapshot.json",
        {
          snapshotVersion: "croco.contract-graph.snapshot.v1",
          graphVersion: "croco.contract-graph.v1",
          routes: [
            {
              routeId: "users.list",
              httpMethod: "GET",
              path: "/users",
              routeContract: { sourceLocation: { path: "src/UsersController.ts", line: 8 } },
              problems: [{ code: "users/not-found" }],
            },
          ],
          consumerCoverage: {
            consumers: [
              {
                consumerId: "rpc-client",
                label: "RPC client",
                generatedArtifact: "libs/provider-rpc/src/users.ts",
              },
            ],
          },
        },
      ],
      [
        "rpc-contracts.json",
        [
          {
            id: "users.find",
            operation: "users.find",
            source: { path: "src/rpc/users.ts", line: 4 },
            problems: ["users/not-found"],
          },
        ],
      ],
      [
        "docs/problem-code-registry.json",
        {
          version: "croco.problem-code-registry.v1",
          problems: [
            {
              code: "users/not-found",
              category: "NotFound",
              status: 404,
              sources: [{ file: "src/problems/UserNotFound.ts", line: 2 }],
            },
          ],
        },
      ],
      [
        ".croco/build/framework-manifest.json",
        {
          version: "croco.framework-manifest.v1",
          entities: [
            {
              kind: "domain.event",
              id: "user.created",
              eventName: "user.created",
              source: { path: "src/events/UserCreated.ts", line: 3 },
            },
          ],
        },
      ],
      [
        "croco.project-map.json",
        {
          version: "croco.project-map.manifest.v1",
          routeGraph: { routes: [{ id: "users.list", method: "GET", path: "/users" }] },
          problems: { responses: [{ routeId: "users.list", code: "users/not-found" }] },
          di: {
            providers: [
              {
                id: "users.repository",
                name: "UsersRepository",
                scope: "singleton",
                dependencies: [],
              },
            ],
          },
          packageGraph: {
            providerProfile: { profileName: "saas-node", packages: ["@croco/storage-s3"] },
          },
          policies: { runtime: { target: "node", requiredCapabilities: ["filesystem"] } },
          generatedArtifacts: [
            {
              kind: "rpc-client",
              path: "libs/provider-rpc/src/users.ts",
              commitPolicy: "commit-required",
            },
          ],
        },
      ],
      [
        "croco-runtime-capability.manifest.json",
        {
          version: "croco.runtime-capability.manifest.v1",
          platform: "node",
          capabilities: { filesystem: true },
          diagnostics: [],
        },
      ],
      [
        "croco-saas-profile.manifest.json",
        {
          schemaVersion: "croco.saas-provider-profile/v1",
          profile: { name: "saas-node" },
          packages: ["@croco/storage-s3"],
        },
      ],
      ["public-api-surface.snapshot.json", { schemaVersion: 1, packages: [] }],
    ]);

    const graph = createShadowAssuranceGraph(
      { assertExecutableAssuranceGraph, createExecutableAssuranceGraph },
      "origin/trunk",
      (path) => artifacts.get(path),
    );

    expect(graph?.artifactVersions).toEqual({
      contractGraph: "croco.contract-graph.snapshot.v1",
      frameworkManifest: "croco.framework-manifest.v1",
      problemRegistry: "croco.problem-code-registry.v1",
      projectMap: "croco.project-map.manifest.v1",
      "projectMap+providerProfile": "croco.project-map.manifest.v1+croco.saas-provider-profile/v1",
      providerProfile: "croco.saas-provider-profile/v1",
      publicApi: "croco.public-api-surface/v1",
      rpcContracts: "croco.rpc-contracts/v1",
      runtimeCapability: "croco.runtime-capability.manifest.v1",
    });
    expect(new Set(graph?.nodes.map(({ kind }) => kind))).toEqual(
      new Set([
        "di-provider",
        "event",
        "generated-client",
        "problem",
        "provider-profile",
        "route",
        "rpc",
        "runtime",
      ]),
    );
  });

  it("returns no graph only when every applicable artifact is absent", () => {
    expect(
      createShadowAssuranceGraph(
        { assertExecutableAssuranceGraph, createExecutableAssuranceGraph },
        "origin/trunk",
        () => undefined,
      ),
    ).toBeUndefined();
  });

  it("distinguishes a missing Git path from invalid revisions and malformed JSON", () => {
    expect(readJsonAtRevision("missing-shadow-assurance-fixture.json", "HEAD")).toBeUndefined();
    expect(() =>
      readJsonAtRevision("public-api-surface.snapshot.json", "invalid-shadow-revision"),
    ).toThrow(/Unable to read assurance artifact.*invalid object name/s);

    const directory = mkdtempSync(resolve(ROOT, ".changed-test-shadow-"));
    const relativePath = `${directory.slice(ROOT.length + 1)}/invalid.json`;
    try {
      writeFileSync(resolve(ROOT, relativePath), "{ invalid json\n");
      expect(() => readJsonAtRevision(relativePath, null)).toThrow(
        "Unable to parse assurance artifact",
      );
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("reads assurance artifacts larger than Node's default child-process buffer", () => {
    withGitTreeArtifact("x".repeat(1024 * 1024), (path, tree) => {
      expect(readJsonAtRevision(path, tree)).toEqual({ payload: "x".repeat(1024 * 1024) });
    });
  });

  it("reports bounded Git buffer exhaustion instead of treating the artifact as missing", () => {
    withGitTreeArtifact("x".repeat(17 * 1024 * 1024), (path, tree) => {
      try {
        readJsonAtRevision(path, tree);
        throw new Error("Expected the bounded Git reader to reject the oversized artifact");
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toContain("ENOBUFS");
        expect((error as Error).cause).toMatchObject({ code: "ENOBUFS" });
      }
    });
  });

  it("reports the malformed evidence or baseline path and preserves the parse cause", () => {
    const directory = mkdtempSync(resolve(ROOT, ".changed-test-shadow-json-"));
    const malformedPath = resolve(directory, "baseline.json");
    try {
      writeFileSync(malformedPath, "{ invalid json\n");
      try {
        readJsonFile(malformedPath);
        throw new Error("Expected malformed JSON to fail");
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toContain(malformedPath);
        expect((error as Error).cause).toBeInstanceOf(SyntaxError);
      }
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});

function withGitTreeArtifact(
  payload: string,
  assertion: (path: string, tree: string) => void,
): void {
  const directory = mkdtempSync(resolve(tmpdir(), "croco-changed-test-shadow-"));
  const objectDirectory = resolve(directory, "objects");
  mkdirSync(objectDirectory);
  const previousObjectDirectory = process.env["GIT_OBJECT_DIRECTORY"];
  process.env["GIT_OBJECT_DIRECTORY"] = objectDirectory;
  const path = "large-shadow-assurance-fixture.json";
  try {
    const content = JSON.stringify({ payload });
    const blob = execFileSync("git", ["hash-object", "-w", "--stdin"], {
      cwd: ROOT,
      encoding: "utf8",
      input: content,
    }).trim();
    const tree = execFileSync("git", ["mktree"], {
      cwd: ROOT,
      encoding: "utf8",
      input: `100644 blob ${blob}\t${path}\n`,
    }).trim();
    assertion(path, tree);
  } finally {
    if (previousObjectDirectory === undefined) delete process.env["GIT_OBJECT_DIRECTORY"];
    else process.env["GIT_OBJECT_DIRECTORY"] = previousObjectDirectory;
    rmSync(directory, { recursive: true, force: true });
  }
}
