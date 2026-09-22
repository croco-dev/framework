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

  it("classifies the live branch protection audit as an intrinsically read-only check", () => {
    const [discovery] = discoverRootVerificationScripts(
      JSON.stringify({
        scripts: {
          "branch-protection:check":
            "node --experimental-strip-types scripts/branch-protection-policy.mts",
        },
      }),
    );

    expect(discovery && classifyVerificationPath(discovery)).toMatchObject({
      classification: "repository-guarded",
      nonmutationEvidence: expect.stringContaining("GitHub GET requests"),
      recoveryCommand: expect.stringContaining("branch-protection-policy.json"),
    });
  });

  it("routes API documentation drift recovery through the explicit writer", () => {
    expect(ROOT_VERIFICATION_POLICY["docs:api:check"]?.recoveryCommand).toBe("pnpm docs:api:write");
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
    expect(ci).toContain(
      'args=(--profile "$VERIFICATION_PROFILE" --allow-pending-release-metadata)',
    );
    expect(ci).not.toContain('args=(--profile "$VERIFICATION_PROFILE")');
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

describe("agent guide verification contract", () => {
  const agentGuide = readFileSync(resolve(repositoryRoot, "AGENTS.md"), "utf-8");
  const packageJson = JSON.parse(
    readFileSync(resolve(repositoryRoot, "package.json"), "utf-8"),
  ) as { readonly scripts: Readonly<Record<string, string>> };
  const lefthook = readFileSync(resolve(repositoryRoot, "lefthook.yaml"), "utf-8");
  const commandsBlock = agentGuide.match(/## Commands\s+```bash\n(?<commands>[\s\S]*?)```/)?.groups
    ?.commands;

  it("documents every canonical root command in the command block", () => {
    expect(commandsBlock, "AGENTS.md must contain a bash code block under Commands").toBeDefined();

    for (const command of ["build", "test", "lint", "format", "typecheck", "check"]) {
      expect(
        packageJson.scripts[command],
        `package.json must define the pnpm ${command} script`,
      ).toBeTruthy();
      expect(
        commandsBlock,
        `AGENTS.md Commands must document the canonical root command: pnpm ${command}`,
      ).toMatch(new RegExp(`^pnpm ${command}(?:\\s|$)`, "m"));
    }
  });

  it("rejects legacy formatter commands and keeps check read-only", () => {
    expect(agentGuide, "AGENTS.md must not mention the retired formatter").not.toMatch(/biome/i);
    expect(
      agentGuide,
      "AGENTS.md must not document the nonexistent pnpm check writer",
    ).not.toContain("pnpm check --write");
    expect(
      commandsBlock,
      "AGENTS.md must describe pnpm check as the read-only repository verification gate",
    ).toMatch(/^pnpm check\s+# 전체 저장소 verification gate \(read-only\)$/m);
  });

  it("names the current formatter, linter, and hook sources of truth", () => {
    for (const path of [".oxlintrc.json", ".oxfmtrc.json", "lefthook.yaml"]) {
      expect(agentGuide, `AGENTS.md must name the current source of truth: ${path}`).toContain(
        path,
      );
    }

    const preCommit = lefthook.match(/pre-commit:\n(?<body>[\s\S]*?)\n\npre-push:/)?.groups?.body;
    expect(preCommit, "lefthook.yaml must define a pre-commit section").toBeDefined();
    for (const tool of ["oxlint", "oxfmt"]) {
      expect(preCommit, `lefthook pre-commit must invoke ${tool}`).toContain(tool);
      expect(
        agentGuide.toLowerCase(),
        `AGENTS.md must describe the pre-commit ${tool} tool`,
      ).toContain(tool);
    }
  });
});

describe("contributor setup contract", () => {
  const contributorGuide = readFileSync(resolve(repositoryRoot, "CONTRIBUTING.md"), "utf-8");
  const packageJson = JSON.parse(
    readFileSync(resolve(repositoryRoot, "package.json"), "utf-8"),
  ) as { readonly scripts: Readonly<Record<string, string>> };

  it("keeps the default setup reproducible and dependency updates explicit", () => {
    expect(packageJson.scripts.setup).toBe(
      "pnpm install --frozen-lockfile && pnpm build && pnpm typecheck && pnpm test",
    );
    expect(packageJson.scripts["setup:update"]).toBe(
      "pnpm install --no-frozen-lockfile && pnpm build && pnpm typecheck && pnpm test",
    );
  });

  it("documents the default and intentional-update setup commands", () => {
    expect(contributorGuide).toContain(
      "`pnpm setup` runs `pnpm install --frozen-lockfile && pnpm build && pnpm typecheck && pnpm test`",
    );
    expect(contributorGuide).toContain(
      "When intentionally changing dependencies, run `pnpm setup:update`.",
    );
    expect(contributorGuide).toContain("`pnpm install --no-frozen-lockfile`");
  });
});

function rootScripts(): Readonly<Record<string, string>> {
  return Object.fromEntries(Object.keys(ROOT_VERIFICATION_POLICY).map((name) => [name, "true"]));
}
