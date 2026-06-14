import { Problem, ProblemCategory } from "@croco/problems-core";

const DETAIL = [
  'crocoVitePlugin() requires optional peer dependency "@cloudflare/vite-plugin" when Cloudflare support is enabled.',
  'Install "@cloudflare/vite-plugin" or call crocoVitePlugin({ cloudflare: false }).',
].join(" ");

export class MissingCloudflareVitePluginProblem extends Problem {
  public constructor(cause?: Error) {
    super(
      "frontend-vite/missing-cloudflare-vite-plugin",
      ProblemCategory.InternalServerError,
      DETAIL,
      cause ? { cause } : undefined,
    );
  }
}
