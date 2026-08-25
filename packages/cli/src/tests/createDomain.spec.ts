import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { describe, expect, it } from "vitest";
import { runCreateDomain } from "../commands/createDomain.js";

describe("runCreateDomain", () => {
  it("should create an API server domain file set and register its controller", async () => {
    const cwd = await createWorkspace();

    const result = await runCreateDomain("User", { cwd });
    const domainDir = path.join(cwd, "apps", "api-server", "src", "domains", "user");
    const controllerContent = await fs.readFile(path.join(domainDir, "UserController.ts"), "utf-8");
    const serviceContent = await fs.readFile(path.join(domainDir, "UserService.ts"), "utf-8");
    const repositoryContent = await fs.readFile(path.join(domainDir, "UserRepository.ts"), "utf-8");
    const entityContent = await fs.readFile(path.join(domainDir, "UserEntity.ts"), "utf-8");
    const barrelContent = await fs.readFile(path.join(domainDir, "index.ts"), "utf-8");
    const entryContent = await fs.readFile(
      path.join(cwd, "apps", "api-server", "src", "index.ts"),
      "utf-8",
    );

    expect(result?.files.map((file) => file.status)).toEqual([
      "created",
      "created",
      "created",
      "created",
      "created",
    ]);
    expect(result?.registration?.status).toBe("updated");
    expect(controllerContent).toContain('@Controller("/user")');
    expect(controllerContent).toContain("export class UserController");
    expect(controllerContent).toContain("import { Controller, Ctx, Get, Post, Put, Delete }");
    expect(controllerContent).toContain(
      'import type { CrocoHttpContext } from "@croco/transports-http";',
    );
    expect(controllerContent).toContain(
      "async create(@Ctx() ctx: CrocoHttpContext): Promise<unknown>",
    );
    expect(controllerContent).not.toContain("RouteContext");
    expect(serviceContent).toContain("export class UserService");
    expect(repositoryContent).toContain(
      'import type { KeyedRepositoryResult, Repository } from "@croco/repository-core";',
    );
    expect(repositoryContent).toContain('import type { UserEntity } from "./UserEntity";');
    expect(repositoryContent).toContain(
      "export class UserRepository implements Repository<UserEntity, string>",
    );
    expect(repositoryContent).toContain("async findById(id: string): Promise<UserEntity | null>");
    expect(repositoryContent).toContain(
      "Promise<ReadonlyArray<KeyedRepositoryResult<string, UserEntity>>>",
    );
    expect(repositoryContent).toContain("async save(entity: UserEntity): Promise<UserEntity>");
    expect(repositoryContent).toContain("async deleteById(id: string): Promise<void>");
    expect(repositoryContent).not.toContain("extends Repository");
    expect(entityContent).not.toContain("@croco/repository-core");
    expect(entityContent).not.toContain("@Entity()");
    expect(entityContent).toContain("export class UserEntity");
    expect(barrelContent).toContain('export { UserController } from "./UserController";');
    expect(entryContent).toContain(
      "import { UserController } from './domains/user/UserController';",
    );
    expect(entryContent).toContain("app.addControllers([UserController]);");
  });

  it("should create files without registering the controller", async () => {
    const cwd = await createWorkspace();

    const result = await runCreateDomain("Order", { cwd, register: false });
    const controllerPath = path.join(
      cwd,
      "apps",
      "api-server",
      "src",
      "domains",
      "order",
      "OrderController.ts",
    );
    const entryContent = await fs.readFile(
      path.join(cwd, "apps", "api-server", "src", "index.ts"),
      "utf-8",
    );

    expect(result?.files.map((file) => file.status)).toEqual([
      "created",
      "created",
      "created",
      "created",
      "created",
    ]);
    expect(result?.registration).toBeNull();
    await expect(fs.access(controllerPath)).resolves.toBeUndefined();
    expect(entryContent).not.toContain("OrderController");
  });

  it("should throw for invalid names", async () => {
    const cwd = await createWorkspace();

    await expect(runCreateDomain("123User", { cwd })).rejects.toThrow("Invalid name: 123User");
  });

  it("should reject missing generated import dependencies before writing files", async () => {
    const cwd = await createWorkspace({ apiServerManifest: "{}" });
    const domainDir = path.join(cwd, "apps", "api-server", "src", "domains", "user");

    await expect(runCreateDomain("User", { cwd })).rejects.toThrow(
      "Missing dependencies in apps/api-server/package.json for generated imports: @croco/protocols-rest, @croco/transports-http, typedi, @croco/repository-core.",
    );
    await expect(fs.access(path.join(domainDir, "UserController.ts"))).rejects.toThrow();
    await expect(fs.access(path.join(domainDir, "UserService.ts"))).rejects.toThrow();
    await expect(fs.access(path.join(domainDir, "UserRepository.ts"))).rejects.toThrow();
  });
});

async function createWorkspace(options: { apiServerManifest?: string } = {}): Promise<string> {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "croco-cli-domain-"));

  await fs.mkdir(path.join(cwd, "apps", "api-server", "src"), { recursive: true });
  await fs.writeFile(path.join(cwd, "pnpm-workspace.yaml"), "packages: []\n");
  await fs.writeFile(
    path.join(cwd, "apps", "api-server", "package.json"),
    options.apiServerManifest ??
      apiServerManifest([
        "@croco/protocols-rest",
        "@croco/transports-http",
        "@croco/repository-core",
        "typedi",
      ]),
  );
  await fs.writeFile(
    path.join(cwd, "apps", "api-server", "src", "index.ts"),
    `import { createApp } from "@croco/transports-http";

const app = createApp();
app.listen({ port: 3000 });
`,
  );

  return cwd;
}

function apiServerManifest(packageNames: readonly string[]): string {
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
