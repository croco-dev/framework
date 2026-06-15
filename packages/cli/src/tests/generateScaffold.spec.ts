import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { describe, expect, it } from "vitest";
import { runGenerateScaffold } from "../commands/generateScaffold.js";

describe("runGenerateScaffold", () => {
  it("should create a domain and page scaffold", async () => {
    const cwd = await createWorkspace();

    const result = await runGenerateScaffold("Product", { cwd });
    const domainDir = path.join(cwd, "apps", "api-server", "src", "domains", "product");
    const pageDir = path.join(cwd, "apps", "console-web", "pages", "product");
    const entryContent = await fs.readFile(
      path.join(cwd, "apps", "api-server", "src", "index.ts"),
      "utf-8",
    );

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
    await expect(fs.access(path.join(domainDir, "ProductService.ts"))).resolves.toBeUndefined();
    await expect(fs.access(path.join(domainDir, "ProductRepository.ts"))).resolves.toBeUndefined();
    await expect(fs.access(path.join(domainDir, "ProductEntity.ts"))).resolves.toBeUndefined();
    await expect(fs.access(path.join(domainDir, "index.ts"))).resolves.toBeUndefined();
    await expect(fs.access(path.join(pageDir, "Page.tsx"))).resolves.toBeUndefined();
    await expect(fs.access(path.join(pageDir, "route.ts"))).resolves.toBeUndefined();
    expect(entryContent).toContain("app.addControllers([ProductController]);");
  });

  it("should report partial failure when page generation fails after domain generation", async () => {
    const cwd = await createWorkspace({ consoleWeb: false });

    await expect(runGenerateScaffold("Invoice", { cwd })).rejects.toThrow(
      "Scaffold partially generated: domain succeeded, page failed.",
    );
    await expect(
      fs.access(
        path.join(cwd, "apps", "api-server", "src", "domains", "invoice", "InvoiceController.ts"),
      ),
    ).resolves.toBeUndefined();
  });

  it("should throw for invalid names", async () => {
    const cwd = await createWorkspace();

    await expect(runGenerateScaffold("123Product", { cwd })).rejects.toThrow(
      "Invalid name: 123Product",
    );
  });
});

async function createWorkspace(options: { consoleWeb?: boolean } = {}): Promise<string> {
  const { consoleWeb = true } = options;
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "croco-cli-scaffold-"));

  await fs.mkdir(path.join(cwd, "apps", "api-server", "src"), { recursive: true });
  await fs.writeFile(path.join(cwd, "pnpm-workspace.yaml"), "packages: []\n");
  await fs.writeFile(
    path.join(cwd, "apps", "api-server", "package.json"),
    packageManifest([
      "@croco/protocols-rest",
      "@croco/repository-core",
      "@croco/transports-http",
      "typedi",
    ]),
  );
  await fs.writeFile(
    path.join(cwd, "apps", "api-server", "src", "index.ts"),
    `const app = createCrocoApp();
app.listen({ port: 3000 });
`,
  );

  if (consoleWeb) {
    await fs.mkdir(path.join(cwd, "apps", "console-web"), { recursive: true });
    await fs.writeFile(
      path.join(cwd, "apps", "console-web", "package.json"),
      packageManifest(["@croco/meta-vite"]),
    );
  }

  return cwd;
}

function packageManifest(packageNames: readonly string[]): string {
  return JSON.stringify(
    {
      dependencies: Object.fromEntries(
        packageNames.map((packageName) => [packageName, "workspace:*"]),
      ),
    },
    null,
    2,
  );
}
