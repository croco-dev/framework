import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { describe, expect, it } from "vitest";
import { runCreatePage } from "../commands/createPage.js";

describe("runCreatePage", () => {
  it("should create an SSR page file set", async () => {
    const cwd = await createWorkspace();

    const result = await runCreatePage("Dashboard", { cwd });
    const pageDir = path.join(cwd, "apps", "console-web", "pages", "dashboard");
    const pageContent = await fs.readFile(path.join(pageDir, "Page.tsx"), "utf-8");
    const routeContent = await fs.readFile(path.join(pageDir, "route.ts"), "utf-8");
    const specContent = await fs.readFile(path.join(pageDir, "Page.spec.tsx"), "utf-8");

    expect(result?.files.map((file) => file.status)).toEqual(["created", "created", "created"]);
    expect(pageContent).toContain("createIsomorphicPageConfig");
    expect(pageContent).toContain("path: '/dashboard'");
    expect(pageContent).not.toContain("CrocoDataFn");
    expect(routeContent).toContain("createCrocoPageConfig");
    expect(routeContent).toContain("path: '/dashboard'");
    expect(specContent).toContain("toMatchSnapshot");
  });

  it("should create a SPA page file set", async () => {
    const cwd = await createWorkspace();

    await runCreatePage("SettingsPanel", { cwd, mode: "spa" });
    const pageDir = path.join(cwd, "apps", "console-web", "pages", "settings-panel");
    const pageContent = await fs.readFile(path.join(pageDir, "Page.tsx"), "utf-8");
    const routeContent = await fs.readFile(path.join(pageDir, "route.ts"), "utf-8");

    expect(pageContent).toContain("usePageData");
    expect(pageContent).not.toContain("createIsomorphicPageConfig");
    expect(routeContent).toContain("import type { RouteObject } from 'react-router';");
    expect(routeContent).toContain("path: '/settings-panel'");
  });

  it("should throw for invalid names", async () => {
    const cwd = await createWorkspace();

    await expect(runCreatePage("123Dashboard", { cwd })).rejects.toThrow(
      "Invalid name: 123Dashboard",
    );
  });
});

async function createWorkspace(): Promise<string> {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "croco-cli-page-"));

  await fs.mkdir(path.join(cwd, "apps", "console-web"), { recursive: true });
  await fs.writeFile(path.join(cwd, "pnpm-workspace.yaml"), "packages: []\n");
  await fs.writeFile(path.join(cwd, "apps", "console-web", "package.json"), "{}");

  return cwd;
}
