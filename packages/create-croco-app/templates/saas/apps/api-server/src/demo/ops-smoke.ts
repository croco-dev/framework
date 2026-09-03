import type { runOpsCheck as runOpsCheckFn } from "@croco/cli";
import { createCrocoApp } from "../app";
import { SaasDemoSmokeProblem } from "../problems";

type CliOpsModule = {
  runOpsCheck: typeof runOpsCheckFn;
};

const CLI_OPS_MODULE = "@croco/cli/ops";
const DEFAULT_DIAGNOSTICS_TOKEN = "local-ops-smoke-token";

async function main(): Promise<void> {
  const diagnosticsToken = process.env.CROCO_DIAGNOSTICS_TOKEN ?? DEFAULT_DIAGNOSTICS_TOKEN;
  process.env.CROCO_DIAGNOSTICS_EXPOSURE = "token";
  process.env.CROCO_DIAGNOSTICS_TOKEN = diagnosticsToken;

  const app = await createCrocoApp({ profileMode: "zero-credential" });
  try {
    const deniedDiagnostics = await app.fetch(new Request("http://localhost/diagnostics"));

    if (deniedDiagnostics.status !== 403) {
      throw new SaasDemoSmokeProblem([
        `Expected unauthenticated diagnostics to return 403, got ${deniedDiagnostics.status}`,
      ]);
    }

    const { runOpsCheck } = (await import(CLI_OPS_MODULE)) as CliOpsModule;
    const report = await runOpsCheck("http://localhost", {
      fetch: (input, init) => app.fetch(new Request(input, init)),
      token: diagnosticsToken,
      timeoutMs: 1000,
    });

    if (report.summary !== "healthy") {
      throw new SaasDemoSmokeProblem([
        `Expected the operations report to be healthy, got ${report.summary}`,
      ]);
    }

    console.log(
      JSON.stringify(
        {
          summary: report.summary,
          endpoints: report.endpoints.map((endpoint) => ({
            name: endpoint.name,
            required: endpoint.required,
            httpStatus: endpoint.httpStatus,
          })),
        },
        null,
        2,
      ),
    );
  } finally {
    await app.disposeApplicationRuntime();
  }
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
});
