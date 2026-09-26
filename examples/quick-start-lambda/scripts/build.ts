import { spawn, type ChildProcess } from "node:child_process";
import { build, context, type BuildOptions, type Plugin } from "esbuild";
import { crocoPlugin } from "@croco/esbuild-plugin";

const watch = process.argv.includes("--watch");
let server: ChildProcess | undefined;

async function stopServer(): Promise<void> {
  const active = server;
  server = undefined;
  if (!active || active.exitCode !== null || active.signalCode !== null) {
    return;
  }

  await new Promise<void>((resolve) => {
    active.once("exit", () => resolve());
    active.kill("SIGTERM");
  });
}

const restartServerPlugin: Plugin = {
  name: "restart-local-server",
  setup(esbuild) {
    esbuild.onEnd(async (result) => {
      await stopServer();
      if (result.errors.length > 0) {
        return;
      }

      server = spawn(process.execPath, ["--import=tsx", "dist/index.js"], {
        stdio: "inherit",
        env: process.env,
      });
    });
  },
};

const options: BuildOptions = {
  absWorkingDir: process.cwd(),
  entryPoints: ["src/index.ts"],
  outfile: "dist/index.js",
  bundle: true,
  format: "cjs",
  platform: "node",
  packages: "external",
  target: "node24",
  tsconfig: "tsconfig.json",
  plugins: [crocoPlugin(), ...(watch ? [restartServerPlugin] : [])],
};

async function main(): Promise<void> {
  if (watch) {
    const builder = await context(options);
    await builder.watch();

    const shutdown = () => {
      void stopServer().then(() => builder.dispose());
    };
    process.once("SIGINT", shutdown);
    process.once("SIGTERM", shutdown);
  } else {
    await build(options);
  }
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
