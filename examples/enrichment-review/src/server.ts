import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { database } from "./database";
import { createFixture } from "./fixture";
import { createDemoServer } from "./http";

const { pool, store } = database();
const { operations } = createFixture(store);
const server = createDemoServer(operations, () =>
  readFile(resolve(__dirname, "../dist/browser.global.js"), "utf8"),
);
server.listen(0, "127.0.0.1", () => {
  const address = server.address();
  if (address && typeof address !== "string") console.log(`http://127.0.0.1:${address.port}`);
});
process.once("SIGTERM", () => {
  server.closeAllConnections();
  server.close(() => {
    void pool.end();
  });
});
