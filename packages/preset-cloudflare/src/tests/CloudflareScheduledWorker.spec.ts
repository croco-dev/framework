// croco-test-clock: controlled
import { resolve } from "node:path";
import { build } from "esbuild";
import { Miniflare } from "miniflare";
import { expect, it } from "vitest";

it("runs native scheduled callbacks in workerd with DI bindings and persisted duplicate outcomes", async () => {
  const bundle = await build({
    stdin: {
      resolveDir: import.meta.dirname,
      sourcefile: "scheduled-worker-fixture.ts",
      contents: `
      import { Context, defineGeneratedDiGraph } from '@croco/framework-context';
      import { createApplicationRuntime, defineCrocoApplication } from '@croco/framework-module';
      import { ExecutionManagerImpl } from '@croco/execution-core';
      import { Cron } from '@croco/triggers-core';
      import { Task } from '@croco/tasks-core';
      import { ProblemFactory } from '@croco/problems-core';
      import { cloudflareWorkersHost, CLOUDFLARE_ENV_TOKEN } from '../application';
      import { compileCloudflareCrons, createCloudflareScheduledHandler } from '../scheduled';
      import { MemoryExecutionStore } from './fixtures/MemoryExecutionStore';
      const observations = [];
      const store = new MemoryExecutionStore();
      class Reports {
        constructor(env) { this.env = env; }
        async run(input, task) {
          observations.push({ binding: this.env.REPORT_BUCKET, input, attempt: task.attempt, requestId: Context.getRequestId() });
          if (input.cron === '0 1 * * *') throw ProblemFactory.badRequest('REPORT_INVALID', 'invalid');
          if (input.cron === '0 2 * * *') return new Promise((resolve) => task.signal.addEventListener('abort', resolve, { once: true }));
          return 'stored';
        }
        async fail(input, task) { return this.run(input, task); }
        async timeout(input, task) { return this.run(input, task); }
      }
      for (const [method, cron] of [['run','*/5 * * * *'],['fail','0 1 * * *'],['timeout','0 2 * * *']]) {
        const descriptor = Object.getOwnPropertyDescriptor(Reports.prototype, method);
        Cron(cron, { name: method })(Reports.prototype, method, descriptor);
        Task({ timeout: method === 'timeout' ? 20 : 30000 })(Reports.prototype, method, descriptor);
      }
      const graph = defineGeneratedDiGraph({ version:'croco.generated-di-graph.v1', graphId:'worker', compilerVersion:'fixture', inputHash:'fixture',
        providers:[{ token:Reports, tokenId:'reports', debugName:'Reports',scope:'request',dependencies:[{token:CLOUDFLARE_ENV_TOKEN,tokenId:'env',parameterIndex:0}],
          factory:(resolver)=>new Reports(resolver.get(CLOUDFLARE_ENV_TOKEN)),sourceLocation:{file:'worker.ts',line:1,column:1}}],roots:[Reports] });
      let ready;
      async function app(env) {
        if (!ready) {
          const runtime = createApplicationRuntime(defineCrocoApplication({ name:'worker', imports:[cloudflareWorkersHost(env)] }),graph);
          ready = runtime.initialize().then(() => createCloudflareScheduledHandler({ runtime, graph,manifest:compileCloudflareCrons(graph),env,
            applicationId:'worker-fixture',executionManager:new ExecutionManagerImpl(store) }));
        }
        return ready;
      }
      export default {
        async fetch() { return Response.json({ observations, executions: await store.list() }); },
        async scheduled(event,env,ctx) { await (await app(env))(event,env,ctx); }
      };
    `,
    },
    bundle: true,
    write: false,
    format: "esm",
    platform: "neutral",
    external: ["node:*"],
    mainFields: ["module", "main"],
    conditions: ["worker", "browser"],
    alias: Object.fromEntries(
      [
        "framework-context",
        "framework-module",
        "problems-core",
        "execution-core",
        "tasks-core",
        "triggers-core",
        "telemetry-api",
        "events-core",
      ].map((name) => [
        `@croco/${name}`,
        resolve(import.meta.dirname, `../../../${name}/src/index.ts`),
      ]),
    ),
  });
  const output = bundle.outputFiles.at(0);
  if (!output) throw new Error("Missing Worker fixture bundle");
  const mf = new Miniflare({
    modules: true,
    script: output.text,
    compatibilityDate: "2026-09-01",
    compatibilityFlags: ["nodejs_compat"],
    bindings: { REPORT_BUCKET: "native-fixture-bucket" },
  });
  try {
    const worker = (await mf.getWorker()) as unknown as {
      scheduled(options: { cron: string; scheduledTime: Date }): Promise<{ outcome: string }>;
    };
    const firing = { cron: "*/5 * * * *", scheduledTime: 1_800_000_000_000 };
    expect(
      await worker.scheduled({ ...firing, scheduledTime: new Date(firing.scheduledTime) }),
    ).toMatchObject({ outcome: "ok" });
    expect(
      await worker.scheduled({ ...firing, scheduledTime: new Date(firing.scheduledTime) }),
    ).toMatchObject({ outcome: "ok" });
    expect(
      await worker.scheduled({ cron: "0 1 * * *", scheduledTime: new Date(firing.scheduledTime) }),
    ).toMatchObject({ outcome: "exception" });
    expect(
      await worker.scheduled({ cron: "0 2 * * *", scheduledTime: new Date(firing.scheduledTime) }),
    ).toMatchObject({ outcome: "exception" });
    const response = await mf.dispatchFetch("https://fixture.test/");
    const body = (await response.json()) as { observations: unknown[]; executions: unknown[] };
    expect(body.observations).toHaveLength(3);
    expect(body.observations[0]).toEqual({
      binding: "native-fixture-bucket",
      input: firing,
      attempt: 1,
      requestId: `cron:worker-fixture:${firing.scheduledTime}`,
    });
    expect(body.executions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ status: "completed", type: "run" }),
        expect.objectContaining({
          status: "failed",
          error: expect.objectContaining({ code: "REPORT_INVALID" }),
        }),
        expect.objectContaining({ status: "timed_out" }),
      ]),
    );
  } finally {
    await mf.dispose();
  }
}, 30_000);
