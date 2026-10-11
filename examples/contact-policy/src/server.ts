import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

const root = process.cwd();
const files = new Map([
  ["/", { path: "index.html", type: "text/html; charset=utf-8" }],
  [
    "/dist/browser.global.js",
    { path: "dist/browser.global.js", type: "text/javascript; charset=utf-8" },
  ],
]);

createServer(async (request, response) => {
  const path = new URL(request.url ?? "/", "http://127.0.0.1").pathname;
  const file = files.get(path);
  if (file === undefined) {
    response.writeHead(404).end();
    return;
  }
  try {
    const content = await readFile(join(root, file.path));
    response.writeHead(200, { "content-type": file.type }).end(content);
  } catch {
    response.writeHead(500).end("Example asset unavailable");
  }
}).listen(4178, "127.0.0.1", () => {
  console.log("Contact Policy example: http://127.0.0.1:4178/");
});
