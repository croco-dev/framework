import type { PluginOption } from "vite";
import { MissingCloudflareVitePluginProblem } from "./problems/MissingCloudflareVitePluginProblem";
import type { CrocoViteOptions } from "./types";

export function crocoVitePlugin(options: CrocoViteOptions = {}): PluginOption[] {
  const { ssr = true, cloudflare: useCloudflare = true } = options;

  if (!useCloudflare) {
    return [];
  }

  return [loadCloudflarePlugin({ ssr })];
}

async function loadCloudflarePlugin(options: { ssr: boolean }): Promise<PluginOption[]> {
  try {
    const { cloudflare } = await import("@cloudflare/vite-plugin");
    return cloudflare({ viteEnvironment: options.ssr ? { name: "ssr" } : undefined });
  } catch (error) {
    if (isMissingCloudflarePluginError(error)) {
      throw new MissingCloudflareVitePluginProblem(error);
    }

    throw error;
  }
}

function isMissingCloudflarePluginError(error: unknown): error is Error {
  if (!(error instanceof Error)) {
    return false;
  }

  const code = (error as { code?: string }).code;
  if (code !== "ERR_MODULE_NOT_FOUND" && code !== "MODULE_NOT_FOUND") {
    return false;
  }

  return (
    /^Cannot find package ['"]@cloudflare\/vite-plugin['"] imported from /.test(error.message) ||
    /^Cannot find module ['"]@cloudflare\/vite-plugin['"]/.test(error.message)
  );
}
