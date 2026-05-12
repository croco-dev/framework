import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const apiIndexPath = fileURLToPath(new URL("../src/content/docs/api/README.md", import.meta.url));
const replacement = "API modules are available from the **API Reference** sidebar.";

export async function sanitizeTypeDocIndex() {
  const content = await readFile(apiIndexPath, "utf8");
  const sanitized = content.replace(
    /## Modules\n\n(?:- \[[^\n]+\]\([^\n]+\/readme\/\)\n?)+/u,
    replacement,
  );

  if (sanitized !== content) {
    await writeFile(apiIndexPath, sanitized.endsWith("\n") ? sanitized : `${sanitized}\n`);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await sanitizeTypeDocIndex();
}
