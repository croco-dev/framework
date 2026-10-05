import { join } from "node:path";
import { appendFileSync } from "node:fs";
import { mergeInto } from "../helpers/fs.js";
import { TEMPLATES_DIR } from "../template-path.js";
import type { GeneratorOptions } from "../types.js";

export function installTrpcNextjs(
  targetDir: string,
  options: Pick<GeneratorOptions, "projectName" | "scope">,
): void {
  const addonDir = join(TEMPLATES_DIR, "addons/trpc-nextjs");
  mergeInto(addonDir, targetDir, {
    projectName: options.projectName,
    scope: options.scope,
    webAppName: "web",
  });
  appendFileSync(
    join(targetDir, "README.md"),
    "\n## Local product example\n\nThe Next.js-hosted tRPC app includes an SSR product → authenticated private brief journey. See [apps/web/README.md](apps/web/README.md) for explicit migration, local test identities, build/run, verification and cleanup.\n",
  );
}
