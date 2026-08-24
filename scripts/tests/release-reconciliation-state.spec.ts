import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";

import {
  readPublishableWorkspacePackages,
  resolveReleaseReconciliationState,
} from "../release-reconciliation-state.mts";
import { classifyVerificationChanges } from "../verification-change-classifier.mts";

const rootDir = resolve(__dirname, "../..");
const versionCandidate = {
  name: "@croco/retry-core",
  version: "9.9.9",
  registry: "https://registry.npmjs.org",
} as const;

describe("release reconciliation state", () => {
  it("discovers only publishable workspace packages", () => {
    const packages = readPublishableWorkspacePackages(rootDir);

    expect(packages.length).toBeGreaterThan(0);
    expect(packages).toContainEqual(
      expect.objectContaining({
        name: "@croco/retry-core",
        registry: "https://registry.npmjs.org",
      }),
    );
    expect(packages.some(({ name }) => name === "@croco/docs")).toBe(false);
  }, 30_000);

  it("carries a superseded Version Packages candidate into current docs verification", async () => {
    const supersededVersionPush = classifyVerificationChanges("push", [
      "packages/retry-core/package.json",
      "packages/retry-core/CHANGELOG.md",
    ]);
    const currentDocsPush = classifyVerificationChanges("push", ["docs/guide.md"]);
    const registryFetch = vi.fn(async () => new Response(null, { status: 404 }));

    expect(supersededVersionPush.shouldRunVerification).toBe(true);
    expect(currentDocsPush).toMatchObject({
      shouldRunVerification: false,
      shouldRunChangesetsAction: false,
    });
    await expect(
      resolveReleaseReconciliationState(
        currentDocsPush.shouldRunVerification,
        currentDocsPush.shouldRunChangesetsAction,
        false,
        [versionCandidate],
        registryFetch,
      ),
    ).resolves.toEqual({
      hasPendingChangesets: false,
      shouldRunChangesetsAction: true,
      shouldRunVerification: true,
      unpublishedPackages: ["@croco/retry-core@9.9.9"],
    });
    expect(registryFetch).toHaveBeenCalledWith(
      "https://registry.npmjs.org/%40croco%2Fretry-core/9.9.9",
      expect.objectContaining({ redirect: "error" }),
    );
  });

  it("keeps a current docs reconciliation lightweight when every version is published", async () => {
    const registryFetch = vi.fn(async () => new Response(null, { status: 200 }));

    await expect(
      resolveReleaseReconciliationState(false, false, false, [versionCandidate], registryFetch),
    ).resolves.toEqual({
      hasPendingChangesets: false,
      shouldRunChangesetsAction: false,
      shouldRunVerification: false,
      unpublishedPackages: [],
    });
  });

  it("carries a raw changeset from a superseded push into the current docs reconciliation", async () => {
    const registryFetch = vi.fn(async () => new Response(null, { status: 200 }));

    await expect(
      resolveReleaseReconciliationState(false, false, true, [versionCandidate], registryFetch),
    ).resolves.toEqual({
      hasPendingChangesets: true,
      shouldRunChangesetsAction: true,
      shouldRunVerification: false,
      unpublishedPackages: [],
    });
  });

  it("defers cumulative publication verification while raw changesets force PR reconciliation", async () => {
    const registryFetch = vi.fn(async () => new Response(null, { status: 404 }));

    await expect(
      resolveReleaseReconciliationState(false, false, true, [versionCandidate], registryFetch),
    ).resolves.toEqual({
      hasPendingChangesets: true,
      shouldRunChangesetsAction: true,
      shouldRunVerification: false,
      unpublishedPackages: ["@croco/retry-core@9.9.9"],
    });
  });

  it("short-circuits registry inspection when the current diff already requires verification", async () => {
    const registryFetch = vi.fn(async () => new Response(null, { status: 500 }));

    await expect(
      resolveReleaseReconciliationState(true, true, false, [versionCandidate], registryFetch),
    ).resolves.toEqual({
      hasPendingChangesets: false,
      shouldRunChangesetsAction: true,
      shouldRunVerification: true,
      unpublishedPackages: [],
    });
    expect(registryFetch).not.toHaveBeenCalled();
  });

  it("fails closed when the registry cannot prove publication state", async () => {
    const registryFetch = vi.fn(async () => new Response(null, { status: 503 }));

    await expect(
      resolveReleaseReconciliationState(false, false, false, [versionCandidate], registryFetch),
    ).rejects.toThrow("returned HTTP 503");
  });
});
