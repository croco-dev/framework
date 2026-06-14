import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { runCreateDomain } from "../../commands/createDomain.js";
import { runCreatePage } from "../../commands/createPage.js";
import { runGenerateScaffold } from "../../commands/generateScaffold.js";

const tmpRoots: string[] = [];

describe("container-fullstack generator e2e", () => {
  afterEach(async () => {
    await Promise.all(
      tmpRoots.splice(0).map((tmpRoot) => fs.rm(tmpRoot, { recursive: true, force: true })),
    );
  });

  it("should create a domain and register its controller", async () => {
    const cwd = await createWorkspace();

    const result = await runCreateDomain("UserProfile", { cwd });
    const domainDir = path.join(cwd, "apps", "api-server", "src", "domains", "user-profile");
    const entryContent = await readApiEntry(cwd);

    expect(result?.files.map((file) => file.status)).toEqual([
      "created",
      "created",
      "created",
      "created",
      "created",
    ]);
    expect(result?.registration?.status).toBe("updated");
    await expect(
      fs.access(path.join(domainDir, "UserProfileController.ts")),
    ).resolves.toBeUndefined();
    await expect(fs.access(path.join(domainDir, "UserProfileService.ts"))).resolves.toBeUndefined();
    await expect(
      fs.access(path.join(domainDir, "UserProfileRepository.ts")),
    ).resolves.toBeUndefined();
    await expect(fs.access(path.join(domainDir, "UserProfileEntity.ts"))).resolves.toBeUndefined();
    await expect(fs.access(path.join(domainDir, "index.ts"))).resolves.toBeUndefined();
    expect(entryContent).toContain(
      "import { UserProfileController } from './domains/user-profile/UserProfileController';",
    );
    expect(entryContent).toContain("app.addControllers([UserProfileController]);");
  });

  it("should create an SSR page", async () => {
    const cwd = await createWorkspace();

    const result = await runCreatePage("Dashboard", { cwd, mode: "ssr" });
    const pageDir = path.join(cwd, "apps", "console-web", "pages", "dashboard");
    const pageContent = await fs.readFile(path.join(pageDir, "Page.tsx"), "utf-8");
    const routeContent = await fs.readFile(path.join(pageDir, "route.ts"), "utf-8");

    expect(result?.files.map((file) => file.status)).toEqual(["created", "created"]);
    expect(pageContent).toContain("export default function DashboardPage");
    expect(routeContent).toContain("defineRoute");
    expect(routeContent).toContain("path: '/dashboard'");
  });

  it("should create a SPA page", async () => {
    const cwd = await createWorkspace();

    const result = await runCreatePage("SettingsPanel", { cwd, mode: "spa" });
    const pageDir = path.join(cwd, "apps", "console-web", "pages", "settings-panel");
    const pageContent = await fs.readFile(path.join(pageDir, "Page.tsx"), "utf-8");
    const routeContent = await fs.readFile(path.join(pageDir, "route.ts"), "utf-8");

    expect(result?.files.map((file) => file.status)).toEqual(["created", "created"]);
    expect(pageContent).toContain("export default function SettingsPanelPage");
    expect(routeContent).toContain("Component: Page");
    expect(routeContent).not.toContain("react-router");
  });

  it("should create a domain and page scaffold", async () => {
    const cwd = await createWorkspace();

    const result = await runGenerateScaffold("Product", { cwd, mode: "spa" });
    const domainDir = path.join(cwd, "apps", "api-server", "src", "domains", "product");
    const pageDir = path.join(cwd, "apps", "console-web", "pages", "product");
    const entryContent = await readApiEntry(cwd);

    expect(result.domain?.files.map((file) => file.status)).toEqual([
      "created",
      "created",
      "created",
      "created",
      "created",
    ]);
    expect(result.domain?.registration?.status).toBe("updated");
    expect(result.page?.files.map((file) => file.status)).toEqual(["created", "created"]);
    await expect(fs.access(path.join(domainDir, "ProductController.ts"))).resolves.toBeUndefined();
    await expect(fs.access(path.join(pageDir, "Page.tsx"))).resolves.toBeUndefined();
    expect(entryContent).toContain("app.addControllers([ProductController]);");
  });

  it("should create a domain without registering its controller", async () => {
    const cwd = await createWorkspace();

    const result = await runCreateDomain("Invoice", { cwd, register: false });
    const entryContent = await readApiEntry(cwd);

    expect(result?.files.map((file) => file.status)).toEqual([
      "created",
      "created",
      "created",
      "created",
      "created",
    ]);
    expect(result?.registration).toBeNull();
    expect(entryContent).not.toContain("InvoiceController");
  });

  it("should overwrite existing generated files", async () => {
    const cwd = await createWorkspace();

    await runCreateDomain("Account", { cwd });
    const result = await runCreateDomain("Account", { cwd, overwrite: true });

    expect(result?.files.map((file) => file.status)).toEqual([
      "overwritten",
      "overwritten",
      "overwritten",
      "overwritten",
      "overwritten",
    ]);
    expect(result?.registration?.status).toBe("updated-idempotent");
  });

  it("should skip file creation in dry-run mode", async () => {
    const cwd = await createWorkspace();

    const result = await runGenerateScaffold("Report", { cwd, dryRun: true });

    expect(result.domain?.files.map((file) => file.status)).toEqual([
      "skipped-dry-run",
      "skipped-dry-run",
      "skipped-dry-run",
      "skipped-dry-run",
      "skipped-dry-run",
    ]);
    expect(result.domain?.registration?.status).toBe("updated");
    expect(result.page?.files.map((file) => file.status)).toEqual([
      "skipped-dry-run",
      "skipped-dry-run",
    ]);
    await expect(
      fs.access(
        path.join(cwd, "apps", "api-server", "src", "domains", "report", "ReportController.ts"),
      ),
    ).rejects.toThrow();
    await expect(
      fs.access(path.join(cwd, "apps", "console-web", "pages", "report", "Page.tsx")),
    ).rejects.toThrow();
    expect(await readApiEntry(cwd)).not.toContain("ReportController");
  });
});

async function createWorkspace(): Promise<string> {
  const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "opencode-croco-e2e-"));
  tmpRoots.push(tmpRoot);

  const cwd = path.join(tmpRoot, "test-app");
  await fs.mkdir(path.join(cwd, "apps", "api-server", "src"), {
    recursive: true,
  });
  await fs.mkdir(path.join(cwd, "apps", "console-web", "pages"), {
    recursive: true,
  });
  await fs.writeFile(path.join(cwd, "pnpm-workspace.yaml"), "packages:\n  - 'apps/*'\n");
  await fs.writeFile(
    path.join(cwd, "package.json"),
    JSON.stringify({ name: "test-app", private: true }, null, 2),
  );
  await fs.writeFile(path.join(cwd, "apps", "api-server", "package.json"), "{}");
  await fs.writeFile(path.join(cwd, "apps", "console-web", "package.json"), "{}");
  await fs.writeFile(
    path.join(cwd, "apps", "console-web", "pages", "index.ts"),
    "export const index = true;\n",
  );
  await fs.writeFile(
    path.join(cwd, "apps", "api-server", "src", "index.ts"),
    `import { createCrocoApp } from '@croco/framework';

const app = createCrocoApp();
app.addControllers([]);
app.listen({ port: 3000 });
`,
  );

  return cwd;
}

async function readApiEntry(cwd: string): Promise<string> {
  return fs.readFile(path.join(cwd, "apps", "api-server", "src", "index.ts"), "utf-8");
}
