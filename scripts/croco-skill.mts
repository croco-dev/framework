#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { argv } from "node:process";
import { pathToFileURL } from "node:url";

const REQUIRED_CAPABILITIES = [
  "auth",
  "billing",
  "persistence-transactions",
  "tasks",
  "telemetry",
  "transport-runtime",
] as const;

const SYNCED_SKILL_PATHS = [
  "SKILL.md",
  "references/architecture.md",
  "references/package-selection.md",
  "references/plugins.md",
  "references/recipes.md",
  "references/verification.md",
  "scripts/inspect-croco-project.mjs",
] as const;

const MATURITY_ORDER = {
  deprecated: 0,
  alpha: 1,
  beta: 2,
  production: 3,
} as const;

type Maturity = keyof typeof MATURITY_ORDER;
type PackageRole = {
  readonly role: string;
  readonly subtype: string;
  readonly runtimes: readonly string[];
  readonly domain: string;
};
type CapabilityImplementation = {
  readonly id: string;
  readonly packages: readonly string[];
  readonly examples: readonly string[];
};
type AgentCapability = {
  readonly contract: string;
  readonly implementations: readonly CapabilityImplementation[];
};
type CertificationRecord = {
  readonly package: string;
  readonly state: string;
};
export type CrocoSkillCatalog = {
  readonly packageRoles: Readonly<Record<string, PackageRole>>;
  readonly maturity: Readonly<Record<Maturity, { readonly packages: readonly string[] }>>;
  readonly certification: { readonly records: readonly CertificationRecord[] };
  readonly agentCapabilities: {
    readonly schemaVersion: number;
    readonly capabilities: Readonly<Record<string, AgentCapability>>;
  };
};
type PackageReadiness = {
  readonly packageName: string;
  readonly maturity: Maturity;
  readonly certification: string;
  readonly runtimes: readonly string[];
};
type ResolvedImplementation = CapabilityImplementation & {
  readonly runtimes: readonly string[];
  readonly packagesReadiness: readonly PackageReadiness[];
};
export type CapabilitySelection =
  | {
      readonly mode: "plugin";
      readonly implementation: string;
      readonly packages: readonly string[];
    }
  | {
      readonly mode: "application-adapter";
      readonly contract: string;
    };

export function loadCrocoSkillCatalog(rootDir: string): CrocoSkillCatalog {
  const path = join(rootDir, "docs/package-catalog.json");
  return JSON.parse(readFileSync(path, "utf8")) as CrocoSkillCatalog;
}

export function resolveCapabilitySelection(
  catalog: CrocoSkillCatalog,
  capabilityId: string,
  runtime: string,
): CapabilitySelection {
  const capability = catalog.agentCapabilities.capabilities[capabilityId];
  if (!capability) throw new Error(`Unknown Croco capability '${capabilityId}'.`);

  const candidates = capability.implementations
    .map((implementation, index) => ({
      ...resolveImplementation(catalog, implementation),
      index,
    }))
    .filter(({ runtimes }) => runtimes.includes(runtime))
    .sort((left, right) => {
      const maturityDifference = implementationMaturity(right) - implementationMaturity(left);
      if (maturityDifference !== 0) return maturityDifference;

      const certificationDifference =
        implementationCertification(right) - implementationCertification(left);
      return certificationDifference !== 0 ? certificationDifference : left.index - right.index;
    });
  const selected = candidates[0];

  return selected
    ? {
        mode: "plugin",
        implementation: selected.id,
        packages: selected.packages,
      }
    : { mode: "application-adapter", contract: capability.contract };
}

export function resolveCapabilityVerificationCommands(
  catalog: CrocoSkillCatalog,
  capabilityId: string,
  runtime: string,
): readonly string[] {
  const capability = catalog.agentCapabilities.capabilities[capabilityId];
  if (!capability) throw new Error(`Unknown Croco capability '${capabilityId}'.`);

  const selection = resolveCapabilitySelection(catalog, capabilityId, runtime);
  if (selection.mode === "application-adapter") {
    return [`pnpm --filter @croco/${packageSlugFromSpecifier(selection.contract)} test`];
  }

  const implementation = capability.implementations.find(
    ({ id }) => id === selection.implementation,
  );
  if (!implementation) {
    throw new Error(`Missing implementation metadata for '${selection.implementation}'.`);
  }
  return deriveVerificationCommands(
    resolveImplementation(catalog, implementation),
    implementation.examples,
  );
}

export function renderPackageSelectionReference(catalog: CrocoSkillCatalog): string {
  const rows = Object.entries(catalog.agentCapabilities.capabilities).flatMap(
    ([capabilityId, capability]) =>
      capability.implementations.map((implementation) => {
        const resolved = resolveImplementation(catalog, implementation);
        const packageLinks = resolved.packagesReadiness
          .map(
            ({ packageName }) =>
              `[@croco/${packageName}](https://github.com/croco-dev/framework/tree/trunk/packages/${packageName})`,
          )
          .join("<br>");
        const readiness = resolved.packagesReadiness
          .map(({ packageName, maturity }) => `@croco/${packageName}: ${maturity}`)
          .join("<br>");
        const certification = resolved.packagesReadiness
          .map(({ packageName, certification: state }) => `@croco/${packageName}: ${state}`)
          .join("<br>");
        const examples = implementation.examples
          .map((path) => `[${path}](https://github.com/croco-dev/framework/blob/trunk/${path})`)
          .join("<br>");
        const verification = deriveVerificationCommands(resolved, implementation.examples)
          .map((command) => `\`${command}\``)
          .join("<br>");

        return [
          capabilityId,
          `\`${capability.contract}\``,
          implementation.id,
          packageLinks,
          resolved.runtimes.join(", ") || "unclaimed",
          readiness,
          certification,
          examples,
          verification,
        ];
      }),
  );
  const table = renderMarkdownTable(
    [
      "Capability",
      "Contract",
      "Implementation",
      "First-party packages",
      "Derived runtimes",
      "Package maturity",
      "Certification",
      "Executable examples",
      "Framework-source verification",
    ],
    rows,
  );

  return [
    "# Package selection",
    "",
    "<!-- Generated by `pnpm skill:write` from `docs/package-catalog.json`. Do not edit directly. -->",
    "",
    "This is a navigation index, not a blanket production-readiness claim. Package roles, runtimes, maturity, and certification come from Croco's canonical catalog. An `unclaimed` runtime means compatibility is not recorded and must be verified before selection.",
    "",
    ...table,
    "",
    "Prefer a compatible first-party implementation even when its maturity or certification requires an explicit limitation. Fall back to an application-owned adapter only when no listed implementation satisfies the runtime and requested capability or when the requested risk level excludes every listed option.",
    "",
  ].join("\n");
}

function renderMarkdownTable(
  headers: readonly string[],
  rows: readonly (readonly string[])[],
): string[] {
  const widths = headers.map((header, index) =>
    Math.max(header.length, ...rows.map((row) => row[index]?.length ?? 0)),
  );
  const renderRow = (cells: readonly string[]): string =>
    `| ${cells.map((cell, index) => cell.padEnd(widths[index] ?? cell.length)).join(" | ")} |`;

  return [
    renderRow(headers),
    renderRow(widths.map((width) => "-".repeat(width))),
    ...rows.map(renderRow),
  ];
}

export function validateCrocoSkill(rootDir: string): readonly string[] {
  const catalog = loadCrocoSkillCatalog(rootDir);
  const errors = validateCatalog(rootDir, catalog);
  const skillRoot = join(rootDir, ".agents/skills/croco");
  const expectedSelection = renderPackageSelectionReference(catalog);
  validateFileContent(
    join(skillRoot, "references/package-selection.md"),
    expectedSelection,
    "Run `pnpm skill:write` to refresh the package-selection reference.",
    errors,
  );
  validateSkillStructure(skillRoot, errors);
  validateEvaluationFixtures(rootDir, catalog, errors);

  const generatedSkillRoot = join(
    rootDir,
    "packages/create-croco-app/templates/addons/agent-rules/.agents/skills/croco",
  );
  for (const relativePath of SYNCED_SKILL_PATHS) {
    const canonicalPath = join(skillRoot, relativePath);
    const generatedPath = join(generatedSkillRoot, relativePath);
    if (!existsSync(canonicalPath)) {
      errors.push(`${canonicalPath} is required.`);
      continue;
    }
    validateFileContent(
      generatedPath,
      readFileSync(canonicalPath, "utf8"),
      "Run `pnpm skill:write` to refresh the generated create-croco-app Skill.",
      errors,
    );
  }

  return errors;
}

export function writeCrocoSkill(rootDir: string): void {
  const catalog = loadCrocoSkillCatalog(rootDir);
  const catalogErrors = validateCatalog(rootDir, catalog);
  if (catalogErrors.length > 0) throw new Error(catalogErrors.join("\n"));

  const skillRoot = join(rootDir, ".agents/skills/croco");
  const selectionPath = join(skillRoot, "references/package-selection.md");
  mkdirSync(dirname(selectionPath), { recursive: true });
  writeFileSync(selectionPath, renderPackageSelectionReference(catalog));

  const generatedSkillRoot = join(
    rootDir,
    "packages/create-croco-app/templates/addons/agent-rules/.agents/skills/croco",
  );
  for (const relativePath of SYNCED_SKILL_PATHS) {
    const canonicalPath = join(skillRoot, relativePath);
    if (!existsSync(canonicalPath)) throw new Error(`${canonicalPath} is required.`);

    const generatedPath = join(generatedSkillRoot, relativePath);
    mkdirSync(dirname(generatedPath), { recursive: true });
    writeFileSync(generatedPath, readFileSync(canonicalPath));
  }
}

function validateCatalog(rootDir: string, catalog: CrocoSkillCatalog): string[] {
  const errors: string[] = [];
  if (catalog.agentCapabilities?.schemaVersion !== 1) {
    errors.push("docs/package-catalog.json agentCapabilities.schemaVersion must be 1.");
    return errors;
  }

  const capabilityIds = Object.keys(catalog.agentCapabilities.capabilities);
  for (const required of REQUIRED_CAPABILITIES) {
    if (!capabilityIds.includes(required)) {
      errors.push(`agentCapabilities.capabilities.${required} is required.`);
    }
  }

  for (const [capabilityId, capability] of Object.entries(catalog.agentCapabilities.capabilities)) {
    const contractPackage = packageSlugFromSpecifier(capability.contract);
    const contractRole = catalog.packageRoles[contractPackage];
    if (!contractRole || !["Contracts", "Kernel"].includes(contractRole.role)) {
      errors.push(
        `agentCapabilities.capabilities.${capabilityId}.contract must reference a Contracts or Kernel package.`,
      );
    }
    if (capability.implementations.length === 0) {
      errors.push(`agentCapabilities.capabilities.${capabilityId} needs an implementation.`);
    }

    const implementationIds = new Set<string>();
    for (const implementation of capability.implementations) {
      if (implementationIds.has(implementation.id)) {
        errors.push(
          `agentCapabilities.capabilities.${capabilityId} repeats implementation '${implementation.id}'.`,
        );
      }
      implementationIds.add(implementation.id);
      if (implementation.packages.length === 0) {
        errors.push(
          `agentCapabilities.capabilities.${capabilityId}.${implementation.id} needs a package.`,
        );
      }
      for (const packageName of implementation.packages) {
        if (catalog.packageRoles[packageName]?.role !== "Plugins") {
          errors.push(
            `agentCapabilities.capabilities.${capabilityId}.${implementation.id} references ${packageName}, which is not a canonical Plugin.`,
          );
        }
        if (!packageMaturity(catalog, packageName)) {
          errors.push(`${packageName} is missing package maturity metadata.`);
        }
      }
      if (implementation.examples.length === 0) {
        errors.push(
          `agentCapabilities.capabilities.${capabilityId}.${implementation.id} needs an executable example.`,
        );
      }
      for (const example of implementation.examples) {
        if (!existsSync(join(rootDir, example))) {
          errors.push(
            `agentCapabilities.capabilities.${capabilityId}.${implementation.id} references missing example ${example}.`,
          );
        }
      }
    }
  }

  return errors;
}

function validateSkillStructure(skillRoot: string, errors: string[]): void {
  const skillPath = join(skillRoot, "SKILL.md");
  if (!existsSync(skillPath)) {
    errors.push(`${skillPath} is required.`);
    return;
  }

  const content = readFileSync(skillPath, "utf8");
  const frontmatter = /^---\n([\s\S]*?)\n---/.exec(content)?.[1] ?? "";
  if (!/^name:\s+croco$/m.test(frontmatter)) {
    errors.push(`${skillPath} must declare name: croco.`);
  }
  if (!/^description:\s+\S.+$/m.test(frontmatter)) {
    errors.push(`${skillPath} must declare a nonempty description.`);
  }
  if (/\[TODO:|<TODO>|TODO\b/.test(content)) {
    errors.push(`${skillPath} contains an unfinished TODO.`);
  }

  for (const relativePath of SYNCED_SKILL_PATHS.filter((path) => path.endsWith(".md"))) {
    const path = join(skillRoot, relativePath);
    if (!existsSync(path)) continue;
    const markdown = readFileSync(path, "utf8");
    for (const match of markdown.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)) {
      const target = match[1];
      if (!target || /^(?:https?:|#)/.test(target)) continue;
      const normalizedTarget = target.split("#", 1)[0];
      if (normalizedTarget && !existsSync(resolve(dirname(path), normalizedTarget))) {
        errors.push(`${path} references missing local resource ${target}.`);
      }
    }
  }
}

function validateEvaluationFixtures(
  rootDir: string,
  catalog: CrocoSkillCatalog,
  errors: string[],
): void {
  const fixturePath = join(rootDir, ".agents/skills/croco/evaluations/package-selection.json");
  if (!existsSync(fixturePath)) {
    errors.push(`${fixturePath} is required.`);
    return;
  }

  const fixtures = JSON.parse(readFileSync(fixturePath, "utf8")) as {
    readonly schemaVersion: number;
    readonly cases: readonly {
      readonly name: string;
      readonly capability: string;
      readonly runtime: string;
      readonly expected: CapabilitySelection;
      readonly expectedVerification: readonly string[];
    }[];
  };
  if (fixtures.schemaVersion !== 1 || fixtures.cases.length < 2) {
    errors.push(`${fixturePath} must define schemaVersion 1 and at least two cases.`);
    return;
  }

  for (const fixture of fixtures.cases) {
    const actual = resolveCapabilitySelection(catalog, fixture.capability, fixture.runtime);
    if (JSON.stringify(actual) !== JSON.stringify(fixture.expected)) {
      errors.push(
        `${fixturePath} case '${fixture.name}' expected ${JSON.stringify(fixture.expected)} but resolved ${JSON.stringify(actual)}.`,
      );
    }
    const actualVerification = resolveCapabilityVerificationCommands(
      catalog,
      fixture.capability,
      fixture.runtime,
    );
    if (JSON.stringify(actualVerification) !== JSON.stringify(fixture.expectedVerification)) {
      errors.push(
        `${fixturePath} case '${fixture.name}' expected verification ${JSON.stringify(fixture.expectedVerification)} but resolved ${JSON.stringify(actualVerification)}.`,
      );
    }
  }
}

function resolveImplementation(
  catalog: CrocoSkillCatalog,
  implementation: CapabilityImplementation,
): ResolvedImplementation {
  const packagesReadiness = implementation.packages.map((packageName) =>
    packageReadiness(catalog, packageName),
  );
  const runtimes = packagesReadiness.some(({ runtimes: claimed }) => claimed.length === 0)
    ? []
    : packagesReadiness
        .map(({ runtimes: claimed }) => claimed)
        .reduce((intersection, claimed) =>
          intersection.filter((runtime) => claimed.includes(runtime)),
        );

  return { ...implementation, runtimes, packagesReadiness };
}

function packageReadiness(catalog: CrocoSkillCatalog, packageName: string): PackageReadiness {
  const role = catalog.packageRoles[packageName];
  const maturity = packageMaturity(catalog, packageName);
  if (!role || !maturity) throw new Error(`Incomplete catalog metadata for ${packageName}.`);

  const certification = catalog.certification.records.find(
    (record) => record.package === `@croco/${packageName}`,
  )?.state;
  return {
    packageName,
    maturity,
    certification: certification ?? "not-recorded",
    runtimes: role.runtimes,
  };
}

function packageMaturity(catalog: CrocoSkillCatalog, packageName: string): Maturity | undefined {
  return (Object.keys(MATURITY_ORDER) as Maturity[]).find((maturity) =>
    catalog.maturity[maturity]?.packages.includes(packageName),
  );
}

function implementationMaturity(implementation: ResolvedImplementation): number {
  return Math.min(
    ...implementation.packagesReadiness.map(({ maturity }) => MATURITY_ORDER[maturity]),
  );
}

function implementationCertification(implementation: ResolvedImplementation): number {
  const scores = implementation.packagesReadiness.map(({ certification }) =>
    certification === "certified" ? 2 : certification === "not-recorded" ? 1 : 0,
  );
  return Math.min(...scores);
}

function deriveVerificationCommands(
  implementation: ResolvedImplementation,
  examples: readonly string[],
): readonly string[] {
  const commands = new Set(
    implementation.packages.map((packageName) => `pnpm --filter @croco/${packageName} test`),
  );
  if (examples.some((path) => path.startsWith("examples/first-party-plugin-composition/"))) {
    commands.add("pnpm --filter @croco-example/first-party-plugin-composition... build");
    commands.add("pnpm --filter @croco-example/first-party-plugin-composition test");
  }
  if (examples.some((path) => path.startsWith("examples/quick-start-lambda/"))) {
    commands.add("pnpm quick-start-lambda:smoke");
  }
  if (examples.some((path) => path.startsWith("packages/create-croco-app/templates/"))) {
    commands.add("pnpm create-croco-app:smoke");
  }
  return [...commands];
}

function packageSlugFromSpecifier(specifier: string): string {
  const match = /^@croco\/([^/]+)(?:\/.*)?$/.exec(specifier);
  if (!match?.[1]) throw new Error(`Invalid Croco package specifier '${specifier}'.`);
  return match[1];
}

function validateFileContent(
  path: string,
  expected: string,
  recovery: string,
  errors: string[],
): void {
  if (!existsSync(path)) {
    errors.push(`${path} is missing. ${recovery}`);
    return;
  }
  if (readFileSync(path, "utf8") !== expected) {
    errors.push(`${path} is stale. ${recovery}`);
  }
}

function main(args: readonly string[]): void {
  const rootDir = resolve(import.meta.dirname, "..");
  if (args.includes("--write")) {
    writeCrocoSkill(rootDir);
  }

  const errors = validateCrocoSkill(rootDir);
  if (errors.length > 0) {
    throw new Error(errors.join("\n"));
  }
  console.log(
    `Croco Skill validation passed (${REQUIRED_CAPABILITIES.length} capabilities with selection and verification fixtures).`,
  );
}

if (import.meta.url === pathToFileURL(argv[1] ?? "").href) {
  try {
    main(argv.slice(2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
