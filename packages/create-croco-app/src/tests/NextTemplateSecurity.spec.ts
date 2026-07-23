import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const TEMPLATES_DIR = join(dirname(fileURLToPath(import.meta.url)), "../../templates");
const NEXT_ADDONS = ["graphql-nextjs", "trpc-nextjs", "web-graphql", "web-trpc"] as const;

describe("Next.js addon templates", () => {
  it.each(NEXT_ADDONS)("pins %s to a Server Actions DoS-safe release", (addon) => {
    const manifestPath = join(TEMPLATES_DIR, "addons", addon, "apps", "web", "package.json.hbs");
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as {
      dependencies?: Record<string, string>;
    };

    expect(manifest.dependencies?.next).toMatch(/^\^?15\.5\.21$/);
  });
});
