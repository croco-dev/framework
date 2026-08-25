import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { registerController } from "../../libs/codemods/registerController.js";

describe("registerController", () => {
  const fixtureDir = join(tmpdir(), `croco-cli-register-controller-${process.pid}`);
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

  it("adds a controller to a named createApp controllers array", async () => {
    await writeFixture(`
import { createCrocoApp, createApp } from '@foo/bar';
import { FooController } from './somewhere';

const controllers = [FooController];

export function createCrocoDiGraphRoots() {
  return controllers;
}

export function createCrocoApp() {
  return createApp({ controllers });
}
`);

    const result = await registerBarController();
    const content = await readFixture();

    expect(result.status).toBe("updated");
    expect(content).toContain("const controllers = [FooController, BarController];");
    expect(content).toContain("return createApp({ controllers });");
    expect(content).toContain("return controllers;");
  });

  it("inserts addControllers before app.listen when no registration exists", async () => {
    await writeFixture(`
import { createCrocoApp } from './app';
import { FooController } from './somewhere';

const app = createCrocoApp();
app.listen({ port: 3000 });
`);

    const result = await registerBarController();
    const content = await readFixture();

    expect(result.status).toBe("updated");
    expect(content).toContain("app.addControllers([BarController]);\napp.listen({ port: 3000 });");
  });

  it("uses a renamed Croco app variable for fallback registration", async () => {
    await writeFixture(`
import { createCrocoApp } from './app';

const api = createCrocoApp();
await api.listen({ port: 3000 });
`);

    const firstResult = await registerBarController();
    const firstContent = await readFixture();
    const secondResult = await registerBarController();
    const secondContent = await readFixture();

    expect(firstResult.status).toBe("updated");
    expect(secondResult.status).toBe("updated-idempotent");
    expect(secondContent).toBe(firstContent);
    expect(secondContent).toContain(
      "api.addControllers([BarController]);\nawait api.listen({ port: 3000 });",
    );
    expect(secondContent).not.toContain("app.addControllers");
  });

  it("ignores unrelated listeners before the Croco app listener", async () => {
    await writeFixture(`
import { createServer } from 'node:http';
import { createApp } from '@croco/transports-http';

const server = createServer();
const croco = createApp();
server.listen(4000);
await croco.listen({ port: 3000 });
`);

    const result = await registerBarController();
    const content = await readFixture();

    expect(result.status).toBe("updated");
    expect(content).toContain("server.listen(4000);");
    expect(content).toContain(
      "croco.addControllers([BarController]);\nawait croco.listen({ port: 3000 });",
    );
    expect(content.indexOf("server.listen(4000);")).toBeLessThan(
      content.indexOf("croco.addControllers([BarController]);"),
    );
  });

  it("ignores a shadowed receiver with the same identifier", async () => {
    await writeFixture(`
import { createCrocoApp } from './app';

const api = createCrocoApp();
function startOtherServer(api: { listen(port: number): void }) {
  api.listen(4000);
}
await api.listen({ port: 3000 });
`);

    const result = await registerBarController();
    const content = await readFixture();

    expect(result.status).toBe("updated");
    expect(content).toContain("api.listen(4000);");
    expect(content).toContain(
      "api.addControllers([BarController]);\nawait api.listen({ port: 3000 });",
    );
  });

  it.each([
    [
      "a standalone listener",
      `
import { listen } from 'node:net';

listen(3000);
`,
    ],
    [
      "a Croco app without its own listener",
      `
import { createServer } from 'node:http';
import { createCrocoApp } from './app';

const server = createServer();
const croco = createCrocoApp();
server.listen(4000);
`,
    ],
    [
      "one Croco app with multiple listeners",
      `
import { createCrocoApp } from './app';

const api = createCrocoApp();
await api.listen({ port: 3000 });
await api.listen({ port: 3001 });
`,
    ],
    [
      "ambiguous Croco app ownership",
      `
import { createCrocoApp } from './app';

const publicApi = createCrocoApp();
const adminApi = createCrocoApp();
await publicApi.listen({ port: 3000 });
await adminApi.listen({ port: 3001 });
`,
    ],
    [
      "an unrelated factory named createApp",
      `
function start(createApp: () => { listen(port: number): void }) {
  const server = createApp();
  server.listen(3000);
}
`,
    ],
    [
      "a mutable Croco app binding",
      `
import { createApp } from '@croco/transports-http';

let app = createApp();
app = getOtherServer();
app.listen(3000);
`,
    ],
  ])("returns unsupported-pattern without changing %s", async (_description, fixture) => {
    await writeFixture(fixture);
    const before = await readFixture();

    const result = await registerBarController();
    const after = await readFixture();

    expect(result.status).toBe("unsupported-pattern");
    expect(result.status === "unsupported-pattern" ? result.hint : "").toContain("Croco app");
    expect(after).toBe(before);
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
