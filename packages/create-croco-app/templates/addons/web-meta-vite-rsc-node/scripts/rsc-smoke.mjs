// Starts the production server and checks one document and one Flight
// request against the built app. Run `pnpm build` first.
import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";

const record = JSON.parse(
  await readFile(new URL("../dist/client/croco-rsc-client-build.json", import.meta.url), "utf8"),
);
const server = spawn(process.execPath, ["dist/server/server.js"], {
  cwd: new URL("..", import.meta.url),
  env: { ...process.env, NODE_ENV: "production", PORT: "0" },
  stdio: ["ignore", "pipe", "inherit"],
});

function expect(condition, message) {
  if (!condition) {
    throw new Error(`rsc smoke failed: ${message}`);
  }
}

try {
  const origin = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("server did not start")), 30_000);
    server.stdout.on("data", (chunk) => {
      const match = /listening (http:\/\/\S+)/.exec(String(chunk));
      if (match) {
        clearTimeout(timer);
        resolve(match[1]);
      }
    });
    server.once("exit", (code) => reject(new Error(`server exited ${code}`)));
  });

  const page = await fetch(`${origin}/`);
  const html = await page.text();
  expect(page.status === 200, `document status ${page.status}`);
  expect(html.includes('data-croco-smoke="server-time"'), "async server component missing");
  expect(
    html.includes('<meta name="croco:rsc-initial-flight" content="streamed">') &&
      html.includes('data-croco-rsc-flight="chunk"') &&
      html.includes('data-croco-rsc-flight="end"'),
    "streamed Flight payload missing",
  );
  const clientEntry = /<script type="module" src="([^"]+)"[^>]* async=""/.exec(html)?.[1];
  expect(clientEntry !== undefined, "client entry script missing");
  expect((await fetch(`${origin}${clientEntry}`)).status === 200, "client entry not served");

  const flight = await fetch(`${origin}/.rsc`, {
    headers: { "x-croco-rsc-client-manifest": record.clientManifestVersion },
  });
  expect(flight.status === 200, `Flight status ${flight.status}`);
  expect((await flight.text()).includes("server-time"), "Flight payload missing server data");

  const stale = await fetch(`${origin}/.rsc`, {
    headers: { "x-croco-rsc-client-manifest": "stale" },
  });
  expect(stale.status === 400, `stale manifest status ${stale.status}`);
  console.log("rsc smoke passed");
} finally {
  server.kill("SIGTERM");
}
