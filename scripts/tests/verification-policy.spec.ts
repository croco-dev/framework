import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  classifyVerificationPath,
  discoverCliVerificationDeclarations,
  discoverPackageVerificationScripts,
  discoverRepositoryVerificationPaths,
  discoverRootVerificationScripts,
  discoverWorkflowVerificationCommands,
  findUnclassifiedVerificationPaths,
  ROOT_VERIFICATION_POLICY,
} from "../verification-policy.mts";

const repositoryRoot = resolve(__dirname, "../..");

describe("verification policy", () => {
  it("classifies every root check and verify script exactly once", () => {
    const packageJson = readFileSync(resolve(repositoryRoot, "package.json"), "utf-8");
    const discoveries = discoverRootVerificationScripts(packageJson);

    expect(discoveries.map(({ name }) => name)).toEqual(
      Object.keys(ROOT_VERIFICATION_POLICY).sort(),
    );
    expect(findUnclassifiedVerificationPaths(discoveries)).toEqual([]);
    expect(
      discoveries.every((discovery) => {
        const policy = classifyVerificationPath(discovery);
        return Boolean(policy?.owner && policy.nonmutationEvidence && policy.recoveryCommand);
      }),
    ).toBe(true);
  });

  it("classifies every bounded repository verification surface", () => {
    const discoveries = discoverRepositoryVerificationPaths(repositoryRoot);

    expect(discoveries.some(({ surface }) => surface === "root-script")).toBe(true);
    expect(discoveries.some(({ surface }) => surface === "workflow-command")).toBe(true);
    expect(discoveries.some(({ surface }) => surface === "package-script")).toBe(true);
    expect(discoveries.some(({ surface }) => surface === "cli-declaration")).toBe(true);
    expect(findUnclassifiedVerificationPaths(discoveries)).toEqual([]);
  });

  it("fails closed for a new root verification script", () => {
    const discoveries = discoverRootVerificationScripts(
      JSON.stringify({ scripts: { ...rootScripts(), "synthetic:verify": "node verify.mjs" } }),
    );

    expect(findUnclassifiedVerificationPaths(discoveries).map(({ name }) => name)).toContain(
      "synthetic:verify",
    );
  });

  it("classifies the CI executable policy as a guarded root verification", () => {
    const [discovery] = discoverRootVerificationScripts(
      JSON.stringify({
        scripts: {
          "ci-executables:check":
            "node --experimental-strip-types scripts/ci-executable-policy.mts",
        },
      }),
    );

    expect(discovery && classifyVerificationPath(discovery)).toMatchObject({
      classification: "repository-guarded",
      recoveryCommand: "Pin the reported executable to an immutable reviewed source",
    });
  });

  it("fails closed for a new workflow verification command", () => {
    const discoveries = discoverWorkflowVerificationCommands({
      ".github/workflows/synthetic.yml": "steps:\n  - run: pnpm synthetic:check",
    });

    expect(findUnclassifiedVerificationPaths(discoveries).map(({ name }) => name)).toEqual([
      "synthetic:check",
    ]);
  });

  it("fails closed for a known workflow command without a guard", () => {
    const discoveries = discoverWorkflowVerificationCommands({
      ".github/workflows/new.yml": "steps:\n  - run: pnpm public-api:check",
    });

    expect(findUnclassifiedVerificationPaths(discoveries).map(({ name }) => name)).toEqual([
      "public-api:check",
    ]);
  });

  it("fails closed for a new generated package verification script", () => {
    const discoveries = discoverPackageVerificationScripts({
      "packages/create-croco-app/templates/blank/package.json.hbs": JSON.stringify({
        scripts: { "synthetic:verify": "synthetic --check" },
      }),
    });

    expect(findUnclassifiedVerificationPaths(discoveries).map(({ name }) => name)).toEqual([
      "synthetic:verify",
    ]);
  });

  it("fails closed for a new literal CLI verification option", () => {
    const discoveries = discoverCliVerificationDeclarations({
      "packages/cli/src/commands/synthetic.ts":
        'export const synthetic = defineCommand().option("--dry-run", "preview");',
    });

    expect(findUnclassifiedVerificationPaths(discoveries).map(({ name }) => name)).toEqual([
      "--dry-run",
    ]);
  });

  it("classifies codegen output checks as regression-tested read-only verification", () => {
    const discoveries = discoverCliVerificationDeclarations({
      "packages/openapi-spec/src/libs/cli.ts":
        'const outputCheck = args.includes("--output-check");',
      "packages/rpc-codegen/src/libs/cli.ts":
        'const outputCheck = args.includes("--output-check");',
    });

    expect(discoveries.map(({ name }) => name)).toEqual(["--output-check", "--output-check"]);
    expect(
      discoveries.map((discovery) => classifyVerificationPath(discovery)?.classification),
    ).toEqual(["generator-regression-tested", "generator-regression-tested"]);
  });
});

describe("workflow read-only contracts", () => {
  const ci = readFileSync(resolve(repositoryRoot, ".github/workflows/ci.yml"), "utf-8");

  it("rejects bare root verification commands in every discovered workflow", () => {
    const discoveries = discoverRepositoryVerificationPaths(repositoryRoot).filter(
      ({ surface }) => surface === "workflow-command",
    );

    expect(findUnclassifiedVerificationPaths(discoveries)).toEqual([]);
  });

  it("routes authoritative CI verification through the guarded shared manifest", () => {
    expect(ci).toContain("scripts/release-spine-evidence.mts");
    expect(ci).toContain('--profile "${{ needs.changes.outputs.profile }}"');
    expect(ci).not.toContain("pnpm audit:read-only");

    const manifest = readFileSync(
      resolve(repositoryRoot, "scripts/verification-manifest.mts"),
      "utf-8",
    );
    for (const recovery of Object.values(ROOT_VERIFICATION_POLICY)) {
      if (!recovery.nonmutationEvidence.includes("shared verification manifest")) continue;
      expect(recovery.owner).toBeTruthy();
    }
    expect(manifest).toContain("scripts/tracked-file-mutation-guard.mts");
  });

  it("keeps compatibility aliases on the authoritative repository profile", () => {
    const packageJson = JSON.parse(
      readFileSync(resolve(repositoryRoot, "package.json"), "utf-8"),
    ) as { readonly scripts: Readonly<Record<string, string>> };

    expect(packageJson.scripts.check).toBe("pnpm verify:repo");
    expect(packageJson.scripts["audit:read-only"]).toBe("pnpm verify:repo");
  });

  it("uses isolated API-doc comparison without checkout repair or formatting", () => {
    const stepStart = ci.indexOf("- name: Build docs and check for drift");
    const nextStep = ci.indexOf("\n      - name:", stepStart + 1);
    const step = ci.slice(stepStart, nextStep === -1 ? undefined : nextStep);

    expect(stepStart).toBeGreaterThan(-1);
    expect(step).toContain("run: pnpm docs:api:check");
    expect(step).not.toContain("pnpm turbo run docs:build");
    expect(step).not.toContain("oxfmt --write");
    expect(step).not.toMatch(/git\s+(?:checkout|restore|reset)/);
  });

  it("keeps pre-push verification serial and prevents docs generation from typecheck", () => {
    const lefthook = readFileSync(resolve(repositoryRoot, "lefthook.yaml"), "utf-8");
    const turbo = JSON.parse(readFileSync(resolve(repositoryRoot, "turbo.json"), "utf-8")) as {
      readonly tasks: Readonly<Record<string, { readonly dependsOn?: readonly string[] }>>;
    };

    expect(lefthook).toMatch(/pre-push:\n  parallel: false/);
    expect(lefthook).toContain(
      "pnpm tracked-files:guard --recovery 'Fix the reported TypeScript diagnostics' -- pnpm exec turbo run typecheck",
    );
    expect(turbo.tasks["@croco/docs#test"]?.dependsOn).not.toContain("build");
    expect(turbo.tasks["@croco/docs#typecheck"]?.dependsOn).not.toContain("build");
  });
});

function rootScripts(): Readonly<Record<string, string>> {
  return Object.fromEntries(Object.keys(ROOT_VERIFICATION_POLICY).map((name) => [name, "true"]));
}
