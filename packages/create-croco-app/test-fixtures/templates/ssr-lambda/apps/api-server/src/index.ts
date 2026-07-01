import { resolve } from "node:path";
import { createCrocoApp } from "./app";

const port = Number(process.env.PORT ?? 3001);
const staticDir = resolve(process.cwd(), "../../dist/client");
const app = createCrocoApp();

await app.listen(port, {
  staticDir,
  spaFallback: true,
});
