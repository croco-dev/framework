import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import { defineCommand } from "citty";
import { formatPublicPageInspection } from "@croco/seo-core";
import type { PublicPageInspection } from "@croco/seo-core";
import { getCrocoCommandRuntime } from "../libs/cliRuntime.js";
import { GLOBAL_OPTIONS } from "./options.js";

/** Config is trusted application code exporting an authorized inspector bound to registered targets. */
export const seo = defineCommand({
  meta: { name: "seo", description: "Inspect a registered public page initial response" },
  args: {
    ...GLOBAL_OPTIONS,
    config: { type: "string", required: true, description: "Application inspector module (.mjs)" },
    target: { type: "string", required: true, description: "Registered target id (never a URL)" },
    json: { type: "boolean", default: false, description: "Emit the same inspection as JSON" },
  },
  async run({ args }) {
    const runtime = getCrocoCommandRuntime();
    const cwd = typeof args.cwd === "string" ? resolve(runtime.cwd, args.cwd) : runtime.cwd;
    const module: { inspect?: (target: string) => Promise<PublicPageInspection> } = await import(
      pathToFileURL(resolve(cwd, args.config)).href
    );
    if (typeof module.inspect !== "function") {
      runtime.stderr("SEO_CONFIG_INVALID: config must export inspect(targetId)");
      runtime.setExitCode(1);
      return;
    }
    const report = await module.inspect(args.target);
    runtime.stdout(args.json ? JSON.stringify(report) : formatPublicPageInspection(report));
    runtime.setExitCode(report.state === "ready" ? 0 : 1);
  },
});
