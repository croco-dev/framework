import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { registerController } from "../../libs/codemods/registerController.js";

describe("registerController", () => {
  const fixtureDir = "/tmp/opencode-croco-cli-t13-fixtures";
  const entryPath = join(fixtureDir, "app.ts");

  beforeEach(async () => {
    await rm(fixtureDir, { recursive: true, force: true });
    await mkdir(fixtureDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(fixtureDir, { recursive: true, force: true });
  });

  it("adds a controller to an empty addControllers array", async () => {
    await writeFixture(`
import { createCrocoApp, createApp } from '@foo/bar';
import { FooController } from './somewhere';

const app = createCrocoApp();
app.addControllers([]);
app.listen({ port: 3000 });
`);

    const result = await registerBarController();
    const content = await readFixture();

    expect(result.status).toBe("updated");
    expect(content).toContain("import { BarController } from './domains/bar/BarController';");
    expect(content).toContain("app.addControllers([BarController]);");
  });

  it("adds a controller to an existing addControllers array idempotently", async () => {
    await writeFixture(`
import { createCrocoApp, createApp } from '@foo/bar';
import { FooController } from './somewhere';

const app = createCrocoApp();
app.addControllers([FooController]);
app.listen({ port: 3000 });
`);

    const firstResult = await registerBarController();
    const firstContent = await readFixture();
    const secondResult = await registerBarController();
    const secondContent = await readFixture();

    expect(firstResult.status).toBe("updated");
    expect(secondResult.status).toBe("updated-idempotent");
    expect(secondContent).toBe(firstContent);
    expect(secondContent).toContain("app.addControllers([FooController, BarController]);");
  });

  it("uncomments the template addControllers registration and adds a controller", async () => {
    await writeFixture(`
import { createCrocoApp, createApp } from '@foo/bar';
import { UserController } from './somewhere';

const app = createCrocoApp();
// Register controllers here
// app.addControllers([UserController]);
app.listen({ port: 3000 });
`);

    const result = await registerBarController();
    const content = await readFixture();

    expect(result.status).toBe("updated");
    expect(content).toContain("app.addControllers([UserController, BarController]);");
    expect(content).not.toContain("// app.addControllers");
  });

  it("adds a controller to createApp controllers options", async () => {
    await writeFixture(`
import { createCrocoApp, createApp } from '@foo/bar';
import { FooController } from './somewhere';

export function createCrocoApp() {
  return createApp({ controllers: [FooController] });
}
`);

    const result = await registerBarController();
    const content = await readFixture();

    expect(result.status).toBe("updated");
    expect(content).toContain("return createApp({ controllers: [FooController, BarController] });");
  });

  it("inserts addControllers before app.listen when no registration exists", async () => {
    await writeFixture(`
import { createCrocoApp, createApp } from '@foo/bar';
import { FooController } from './somewhere';

const app = createCrocoApp();
app.listen({ port: 3000 });
`);

    const result = await registerBarController();
    const content = await readFixture();

    expect(result.status).toBe("updated");
    expect(content).toContain("app.addControllers([BarController]);\napp.listen({ port: 3000 });");
  });

  it("returns unsupported-pattern without changing spread registration", async () => {
    await writeFixture(`
import { createCrocoApp, createApp } from '@foo/bar';
import { FooController } from './somewhere';

const app = createCrocoApp();
const someArray = [FooController];
app.addControllers([...someArray]);
app.listen({ port: 3000 });
`);
    const before = await readFixture();

    const result = await registerBarController();
    const after = await readFixture();

    expect(result.status).toBe("unsupported-pattern");
    expect(after).toBe(before);
  });

  async function registerBarController() {
    return registerController({
      entryPath,
      importPath: "./domains/bar/BarController",
      className: "BarController",
    });
  }

  async function writeFixture(content: string): Promise<void> {
    await writeFile(entryPath, content.trimStart(), "utf-8");
  }

  async function readFixture(): Promise<string> {
    return readFile(entryPath, "utf-8");
  }
});
