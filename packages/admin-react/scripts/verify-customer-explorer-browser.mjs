import { createRequire } from "node:module";
import { createServer } from "node:http";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const requireDocs = createRequire(resolve(root, "packages/docs/package.json"));
const { chromium } = requireDocs("@playwright/test");
const requireBuild = createRequire(resolve(root, "packages/admin-react/package.json"));
const { build } = requireBuild("tsup");
const directory = await mkdtemp(resolve(tmpdir(), "croco-explorer-browser-"));
const server = createServer(async (request, response) => {
  if (request.url === "/fixture.js") {
    response.setHeader("Content-Type", "text/javascript");
    response.end(await readFile(resolve(directory, "CustomerExplorer.mounted.global.js")));
  } else {
    response.setHeader("Content-Type", "text/html");
    response.end('<main id="fixture"></main><script src="/fixture.js"></script>');
  }
});
let browser;
try {
  await build({
    entry: [resolve(root, "packages/admin-react/src/tests/CustomerExplorer.mounted.ts")],
    outDir: directory,
    format: ["iife"],
    globalName: "ExplorerFixture",
    platform: "browser",
    tsconfig: resolve(root, "packages/admin-react/tsconfig.json"),
    noExternal: [/.*/],
    define: { "process.env.NODE_ENV": '"development"' },
    dts: false,
    config: false,
  });
  await new Promise((resolveListening) => server.listen(0, "127.0.0.1", resolveListening));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Browser fixture address missing");
  browser = await chromium.launch({ channel: "chrome", headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.exposeFunction("recordEvidence", (message) => process.stdout.write(`${message}\n`));
  await page.goto(`http://127.0.0.1:${address.port}`);
  await page
    .evaluate(async () =>
      window.ExplorerFixture.verifyMountedCustomerExplorer(
        document.getElementById("fixture"),
        window.recordEvidence,
      ),
    )
    .catch(async (error) => {
      console.error(errors);
      console.error(await page.locator("#fixture").innerHTML());
      throw error;
    });
  if (errors.length) throw new Error(errors.join("\n"));
  process.stdout.write(
    "Customer Explorer mounted Chrome regression passed without page/console errors.\n",
  );
} finally {
  await browser?.close();
  server.closeAllConnections();
  await new Promise((resolveClosed) => server.close(resolveClosed));
  await rm(directory, { recursive: true, force: true });
}
