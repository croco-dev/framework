import { copyFileSync, mkdirSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

const sourceDirectory = resolve("schemas");
const outputDirectory = resolve("dist", "schemas");

mkdirSync(outputDirectory, { recursive: true });
for (const fileName of readdirSync(sourceDirectory)
  .filter((name) => name.endsWith(".json"))
  .sort()) {
  copyFileSync(resolve(sourceDirectory, fileName), resolve(outputDirectory, fileName));
}
