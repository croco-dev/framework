import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parse } from "yaml";
import { describe, expect, it } from "vitest";

import { POLAR_LIVE_SMOKE_RESOURCE_GROUPS } from "../../packages/billing-polar/src/tests/polarLiveSmokeResources";

const workflow = readFileSync(
  resolve(import.meta.dirname, "../../.github/workflows/live-tests.yml"),
  "utf8",
);
const resources = JSON.parse(
  readFileSync(resolve(import.meta.dirname, "../../config/live-test-resources.json"), "utf8"),
) as Readonly<Record<string, readonly string[]>>;
const parsed = parse(workflow) as {
  readonly jobs: {
    readonly live: {
      readonly env?: Readonly<Record<string, string>>;
      readonly steps: readonly {
        readonly name?: string;
        readonly "continue-on-error"?: boolean;
        readonly env?: Readonly<Record<string, string>>;
        readonly if?: string;
        readonly run?: string;
      }[];
    };
  };
};

describe("scheduled live test workflow", () => {
  it("runs the authoritative inventory lane and enforced evidence reconciliation on a schedule", () => {
    expect(workflow).toContain("schedule:");
    expect(workflow).toContain("scripts/test-lane-runner.mts");
    expect(workflow).toContain("--lane live --allow-live");
    expect(workflow).toContain("scripts/test-evidence-reconcile.mts");
    expect(workflow).toContain("--profile scheduled-live");
    expect(workflow).toContain("retention-days: 90");
    const build = workflow.indexOf("run: pnpm build");
    const liveLane = workflow.indexOf("scripts/test-lane-runner.mts");
    expect(build).toBeGreaterThan(-1);
    expect(liveLane).toBeGreaterThan(-1);
    expect(build).toBeLessThan(liveLane);
  });

  it("keeps provider credentials out of setup, install, and build steps", () => {
    const job = parsed.jobs.live;
    expect(job.env).toBeUndefined();

    for (const name of [
      "Checkout",
      "Setup pnpm",
      "Setup Node.js",
      "Install dependencies",
      "Build live test dependency graphs",
    ]) {
      const step = job.steps.find((candidate) => candidate.name === name);
      expect(step, name).toBeDefined();
      expect(step?.env, name).toBeUndefined();
    }
  });

  it("injects only each owner's declared resources into its exact live test subprocess", () => {
    const liveSteps = parsed.jobs.live.steps.filter(({ run }) =>
      run?.includes("scripts/test-lane-runner.mts"),
    );
    expect(liveSteps).toHaveLength(Object.keys(resources).length);

    for (const [owner, requiredNames] of Object.entries(resources)) {
      const step = liveSteps.find(({ run }) => run?.includes(`--owner ${owner}`));
      expect(step, owner).toBeDefined();
      expect(step?.["continue-on-error"], owner).toBe(true);
      expect(Object.keys(step?.env ?? {}).sort(), owner).toEqual([...requiredNames].sort());
      for (const name of requiredNames) {
        const expected = name.startsWith("CROCO_LIVE_") ? "true" : `\${{ secrets.${name} }}`;
        expect(step?.env?.[name], `${owner}:${name}`).toBe(expected);
      }
    }
  });

  it("keeps every Polar smoke prerequisite aligned with its inventory and workflow step", () => {
    const requiredNames = [
      ...new Set(Object.values(POLAR_LIVE_SMOKE_RESOURCE_GROUPS).flat()),
    ].sort();
    const step = parsed.jobs.live.steps.find(({ run }) =>
      run?.includes("--owner @croco/billing-polar"),
    );

    expect([...(resources["@croco/billing-polar"] ?? [])].sort()).toEqual(requiredNames);
    expect(Object.keys(step?.env ?? {}).sort()).toEqual(requiredNames);
  });

  it("declares the Cloudinary live-smoke opt-in as a required scheduled resource", () => {
    expect(resources["@croco/storage-cloudinary"]).toContain("CROCO_LIVE_CLOUDINARY");
  });

  it("runs reconciliation after every non-cancelled owner outcome", () => {
    const reconciliation = parsed.jobs.live.steps.find(
      ({ name }) => name === "Enforce scheduled-live evidence",
    );

    expect(reconciliation?.if).toBe("${{ !cancelled() }}");
  });
});
