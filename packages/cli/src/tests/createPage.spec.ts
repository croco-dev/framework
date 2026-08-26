import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { Project, ts } from "ts-morph";
import { describe, expect, it } from "vitest";
import { runCreatePage } from "../commands/createPage.js";

const COMPILER_CONTRACT_TEST_TIMEOUT_MS = 30_000;
const DEPENDENCY_FIELDS = [
  "dependencies",
  "devDependencies",
  "peerDependencies",
  "optionalDependencies",
] as const;

type DependencyField = (typeof DEPENDENCY_FIELDS)[number];
type PackageManifest = Partial<Record<DependencyField, Record<string, string>>>;

describe("runCreatePage", () => {
  it("should create an SSR page file set", async () => {
    const cwd = await createWorkspace();

    const result = await runCreatePage("Dashboard", { cwd });
    const pageDir = path.join(cwd, "apps", "console-web", "pages", "dashboard");
    const pageContent = await fs.readFile(path.join(pageDir, "Page.tsx"), "utf-8");
    const routeContent = await fs.readFile(path.join(pageDir, "route.ts"), "utf-8");

    expect(result?.files.map((file) => file.status)).toEqual(["created", "created"]);
    expect(pageContent).toContain("export default function DashboardPage");
    expect(pageContent).not.toContain("@croco/frontend-react");
    expect(routeContent).toContain(
      "import { defineRoute, type PageRouteDefinition } from '@croco/meta-vite';",
    );
    expect(routeContent).toContain("satisfies PageRouteDefinition");
    expect(routeContent).toContain("export default defineRoute(route)");
    expect(routeContent).toContain("mode: 'ssr'");
    expect(pageContent).not.toContain("CrocoDataFn");
    expect(routeContent).not.toContain("routeConfig");
    expect(routeContent).not.toContain("Component: Page");
    expect(routeContent).toContain('path: "/dashboard"');
  });

  it(
    "should typecheck the generated SSR route against the meta-vite contract",
    async () => {
      const cwd = await createWorkspace();

      await runCreatePage("Dashboard", { cwd, mode: "ssr" });
      const pageDir = path.join(cwd, "apps", "console-web", "pages", "dashboard");
      const pagePath = path.join(pageDir, "Page.tsx");
      const routePath = path.join(pageDir, "route.ts");

      await expectGeneratedRouteToTypecheckAndPreservePath(pagePath, routePath, "/dashboard");
    },
    COMPILER_CONTRACT_TEST_TIMEOUT_MS,
  );

  it.each([
    { label: "ordinary paths", routePath: "/ordinary", emittedPath: 'path: "/ordinary"' },
    {
      label: "apostrophes",
      routePath: "/author's-page",
      emittedPath: 'path: "/author\'s-page"',
    },
    {
      label: "double quotes",
      routePath: '/quoted/"draft"',
      emittedPath: 'path: "/quoted/\\"draft\\""',
    },
    {
      label: "backslashes",
      routePath: "/files\\draft",
      emittedPath: 'path: "/files\\\\draft"',
    },
    {
      label: "Unicode line separators",
      routePath: "/lines/se\u2028p\u2029arator",
      emittedPath: 'path: "/lines/se\\u2028p\\u2029arator"',
    },
  ])(
    "should emit $label as exact TypeScript literals in SPA and SSR routes",
    async ({ routePath, emittedPath }) => {
      for (const mode of ["spa", "ssr"] as const) {
        const cwd = await createWorkspace({
          consoleWebManifest: consoleWebManifest([
            mode === "spa" ? "@croco/frontend-vite" : "@croco/meta-vite",
          ]),
        });

        await runCreatePage("EscapedPath", { cwd, mode, path: routePath });
        const pageDir = path.join(cwd, "apps", "console-web", "pages", "escaped-path");
        const pagePath = path.join(pageDir, "Page.tsx");
        const generatedRoutePath = path.join(pageDir, "route.ts");
        const routeContent = await fs.readFile(generatedRoutePath, "utf-8");

        expect(routeContent).toContain(emittedPath);
        await expectGeneratedRouteToTypecheckAndPreservePath(
          pagePath,
          generatedRoutePath,
          routePath,
        );
      }
    },
    COMPILER_CONTRACT_TEST_TIMEOUT_MS,
  );

  it("should create an explicit SPA legacy frontend-vite page file set", async () => {
    const cwd = await createWorkspace({
      consoleWebManifest: consoleWebManifest(["@croco/frontend-vite"]),
    });

    await runCreatePage("SettingsPanel", { cwd, mode: "spa" });
    const pageDir = path.join(cwd, "apps", "console-web", "pages", "settings-panel");
    const pageContent = await fs.readFile(path.join(pageDir, "Page.tsx"), "utf-8");
    const routeContent = await fs.readFile(path.join(pageDir, "route.ts"), "utf-8");

    expect(pageContent).toContain("export default function SettingsPanelPage");
    expect(pageContent).not.toContain("@croco/frontend-react");
    expect(routeContent).toContain("Component: Page");
    expect(routeContent).toContain("export const routeConfig");
    expect(routeContent).not.toContain("@croco/meta-vite");
    expect(routeContent).not.toContain("defineRoute");
    expect(routeContent).not.toContain("react-router");
    expect(routeContent).toContain('path: "/settings-panel"');
  });

  it("should keep SSR generated imports declared by scaffold manifests", async () => {
    for (const dependencyField of ["dependencies", "devDependencies"] as const) {
      const cwd = await createWorkspace({
        consoleWebManifest: consoleWebManifest(["@croco/meta-vite"], dependencyField),
      });

      const result = await runCreatePage("Dashboard", { cwd, mode: "ssr" });

      await expectMissingGeneratedDependencies(cwd, result?.files.map((file) => file.path) ?? []);
    }
  });

  it("should keep SPA generated imports declared by scaffold manifests", async () => {
    const cwd = await createWorkspace({
      consoleWebManifest: consoleWebManifest(["@croco/frontend-vite"], "devDependencies"),
    });

    const result = await runCreatePage("SettingsPanel", { cwd, mode: "spa" });

    await expectMissingGeneratedDependencies(cwd, result?.files.map((file) => file.path) ?? []);
  });

  it("should reject missing SSR route import dependencies before writing files", async () => {
    const cwd = await createWorkspace({ consoleWebManifest: "{}" });

    await expect(runCreatePage("Dashboard", { cwd, mode: "ssr" })).rejects.toThrow(
      "Missing dependencies in apps/console-web/package.json for generated imports: @croco/meta-vite.",
    );
    await expect(
      fs.access(path.join(cwd, "apps", "console-web", "pages", "dashboard", "route.ts")),
    ).rejects.toThrow();
  });

  it("should reject SSR pages in SPA scaffolds before writing files", async () => {
    const cwd = await createWorkspace({
      consoleWebManifest: consoleWebManifest(["@croco/frontend-vite"], "devDependencies"),
    });

    await expect(runCreatePage("Dashboard", { cwd })).rejects.toThrow(
      "Page mode 'ssr' is not supported by apps/console-web. Supported modes: spa",
    );
    await expect(
      fs.access(path.join(cwd, "apps", "console-web", "pages", "dashboard", "Page.tsx")),
    ).rejects.toThrow();
  });

  it("should reject SPA pages in SSR scaffolds before writing files", async () => {
    const cwd = await createWorkspace({
      consoleWebManifest: consoleWebManifest(["@croco/meta-vite"], "devDependencies"),
    });

    await expect(runCreatePage("SettingsPanel", { cwd, mode: "spa" })).rejects.toThrow(
      "Page mode 'spa' is not supported by apps/console-web. Supported modes: ssr",
    );
    await expect(
      fs.access(path.join(cwd, "apps", "console-web", "pages", "settings-panel", "Page.tsx")),
    ).rejects.toThrow();
  });

  it("should throw for invalid names", async () => {
    const cwd = await createWorkspace();

    await expect(runCreatePage("123Dashboard", { cwd })).rejects.toThrow(
      "Invalid name: 123Dashboard",
    );
  });

  it.each(["", "relative/path"])(
    "should reject invalid route path %j before writing files",
    async (routePath) => {
      const cwd = await createWorkspace();

      await expect(runCreatePage("InvalidPath", { cwd, path: routePath })).rejects.toThrow(
        `Invalid route path: ${JSON.stringify(routePath)}. Route paths must start with '/'.`,
      );
      await expect(
        fs.access(path.join(cwd, "apps", "console-web", "pages", "invalid-path")),
      ).rejects.toThrow();
    },
  );
});

async function expectGeneratedRouteToTypecheckAndPreservePath(
  pagePath: string,
  routePath: string,
  expectedPath: string,
): Promise<void> {
  const project = new Project({
    useInMemoryFileSystem: true,
    compilerOptions: {
      jsx: ts.JsxEmit.Preserve,
      strict: true,
      target: ts.ScriptTarget.ES2022,
    },
  });
  project.createSourceFile(
    "/types/jsx.d.ts",
    `declare namespace JSX {
  type Element = unknown;

  interface IntrinsicElements {
    main: unknown;
    h1: unknown;
    p: unknown;
  }
}
`,
  );
  project.createSourceFile(
    "/types/meta-vite.d.ts",
    `declare module '@croco/meta-vite' {
  export type RenderRouteComponentProps = {
    readonly request: Request;
    readonly context?: unknown;
  };

  export type PageRouteDefinition = {
    readonly path: string;
    readonly component: (props: RenderRouteComponentProps) => JSX.Element;
    readonly mode?: 'ssr' | 'ssg' | 'isr' | 'rsc';
  };

  export function defineRoute(route: PageRouteDefinition): PageRouteDefinition;
}
`,
  );
  project.createSourceFile(pagePath, await fs.readFile(pagePath, "utf-8"));
  const routeSource = project.createSourceFile(routePath, await fs.readFile(routePath, "utf-8"));

  const diagnostics = project.getPreEmitDiagnostics();
  const pathProperty = routeSource
    .getDescendantsOfKind(ts.SyntaxKind.PropertyAssignment)
    .find((property) => property.getName() === "path");

  expect(project.formatDiagnosticsWithColorAndContext(diagnostics)).toBe("");
  expect(
    pathProperty?.getInitializerIfKindOrThrow(ts.SyntaxKind.StringLiteral).getLiteralValue(),
  ).toBe(expectedPath);
}

async function createWorkspace(options: { consoleWebManifest?: string } = {}): Promise<string> {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "croco-cli-page-"));

  await fs.mkdir(path.join(cwd, "apps", "console-web"), { recursive: true });
  await fs.writeFile(path.join(cwd, "pnpm-workspace.yaml"), "packages: []\n");
  await fs.writeFile(
    path.join(cwd, "apps", "console-web", "package.json"),
    options.consoleWebManifest ?? consoleWebManifest(["@croco/meta-vite"]),
  );

  return cwd;
}

function consoleWebManifest(
  packageNames: readonly string[],
  dependencyField: DependencyField = "dependencies",
): string {
  return JSON.stringify(
    {
      [dependencyField]: Object.fromEntries(
        packageNames.map((packageName) => [packageName, "workspace:*"]),
      ),
    },
    null,
    2,
  );
}

async function expectMissingGeneratedDependencies(
  cwd: string,
  generatedFilePaths: readonly string[],
): Promise<void> {
  const manifest = JSON.parse(
    await fs.readFile(path.join(cwd, "apps", "console-web", "package.json"), "utf-8"),
  ) as PackageManifest;
  const declaredDependencies = collectDeclaredDependencies(manifest);
  const generatedImports = await collectBareImports(generatedFilePaths);
  const missingDependencies = [...generatedImports].filter(
    (moduleSpecifier) => !declaredDependencies.has(toPackageName(moduleSpecifier)),
  );

  expect(missingDependencies).toEqual([]);
}

function collectDeclaredDependencies(manifest: PackageManifest): Set<string> {
  return new Set(DEPENDENCY_FIELDS.flatMap((field) => Object.keys(manifest[field] ?? {})));
}

async function collectBareImports(filePaths: readonly string[]): Promise<Set<string>> {
  const project = new Project({ useInMemoryFileSystem: true });
  const moduleSpecifiers = new Set<string>();

  for (const filePath of filePaths) {
    const content = await fs.readFile(filePath, "utf-8");
    const sourceFile = project.createSourceFile(filePath, content);
    const imports = sourceFile
      .getImportDeclarations()
      .map((declaration) => declaration.getModuleSpecifierValue());
    const exports = sourceFile
      .getExportDeclarations()
      .map((declaration) => declaration.getModuleSpecifierValue())
      .filter((value): value is string => typeof value === "string");

    for (const moduleSpecifier of [...imports, ...exports]) {
      if (isBareModuleSpecifier(moduleSpecifier)) {
        moduleSpecifiers.add(moduleSpecifier);
      }
    }
  }

  return moduleSpecifiers;
}

function isBareModuleSpecifier(moduleSpecifier: string): boolean {
  return (
    !moduleSpecifier.startsWith(".") &&
    !moduleSpecifier.startsWith("/") &&
    !moduleSpecifier.startsWith("node:")
  );
}

function toPackageName(moduleSpecifier: string): string {
  if (!moduleSpecifier.startsWith("@")) {
    return moduleSpecifier.split("/")[0] ?? moduleSpecifier;
  }

  const [scope, name] = moduleSpecifier.split("/");

  return `${scope}/${name}`;
}
