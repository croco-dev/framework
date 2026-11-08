import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  Container,
  GENERATED_DI_GRAPH_VERSION,
  MetadataStorage,
  Token,
  defineGeneratedDiGraph,
} from "@croco/framework-context";
import { Cron, OnEvent, triggerRegistry } from "@croco/triggers-core";
import { compileCloudflareCrons, normalizeCloudflareCron } from "../cron";
import type { GeneratedProviderDefinition } from "@croco/framework-context";

const SOURCE = { file: "src/jobs.ts", line: 1, column: 1 } as const;

function provider(token: new () => object, tokenId: string): GeneratedProviderDefinition {
  return {
    token,
    tokenId,
    debugName: token.name,
    scope: "singleton",
    dependencies: [],
    factory: vi.fn(() => new token()),
    sourceLocation: SOURCE,
  };
}

function graph(providers: readonly GeneratedProviderDefinition[], inputHash = "app-source-hash") {
  return defineGeneratedDiGraph({
    version: GENERATED_DI_GRAPH_VERSION,
    graphId: "test.cloudflare-crons",
    compilerVersion: "test",
    inputHash,
    providers,
    roots: providers.map(({ token }) => token),
  });
}

describe("Cloudflare cron manifest", () => {
  beforeEach(() => {
    Container.reset();
    MetadataStorage.clear();
  });

  it("compiles a deterministic graph-scoped manifest without instantiation or metadata mutation", () => {
    class Reports {
      @Cron("  17\t8 * jan mon-fri ", { name: "weekly-report", timezone: "UTC" })
      weekly() {}

      @Cron("*/13 * * * *")
      minute() {}

      @OnEvent("report-ready")
      event() {}

      @Cron("invalid", { enabled: false, timezone: "Asia/Seoul" })
      disabled() {}
    }
    class Cleanup {
      @Cron("*/13 * * * *", { name: "cleanup" })
      run() {}
    }
    class OtherApplication {
      @Cron("invalid", { timezone: "Asia/Seoul" })
      run() {}
    }
    const reports = provider(Reports, "app:reports");
    const cleanup = provider(Cleanup, "app:cleanup");
    const applicationGraph = graph([reports, cleanup]);
    const before = triggerRegistry.getTriggers(Reports.prototype);

    const manifest = compileCloudflareCrons(applicationGraph);

    expect(manifest).toEqual({
      schemaVersion: "croco.cloudflare-crons.v1",
      graphInputHash: "app-source-hash",
      crons: ["*/13 * * * *", "17 8 * JAN MON-FRI"],
      bindings: [
        {
          id: "app:reports#minute",
          providerTokenId: "app:reports",
          methodName: "minute",
          cron: "*/13 * * * *",
        },
        { id: "cleanup", providerTokenId: "app:cleanup", methodName: "run", cron: "*/13 * * * *" },
        {
          id: "weekly-report",
          providerTokenId: "app:reports",
          methodName: "weekly",
          cron: "17 8 * JAN MON-FRI",
        },
      ],
    });
    expect(compileCloudflareCrons(graph([cleanup, reports]))).toEqual(manifest);
    expect(compileCloudflareCrons(graph([cleanup], "second-app-hash"))).toEqual({
      schemaVersion: "croco.cloudflare-crons.v1",
      graphInputHash: "second-app-hash",
      crons: ["*/13 * * * *"],
      bindings: [
        { id: "cleanup", providerTokenId: "app:cleanup", methodName: "run", cron: "*/13 * * * *" },
      ],
    });
    expect(reports.factory).not.toHaveBeenCalled();
    expect(cleanup.factory).not.toHaveBeenCalled();
    expect(triggerRegistry.getTriggers(Reports.prototype)).toEqual(before);
    expect(applicationGraph.providers).toEqual([reports, cleanup]);
    expect(Container.has(Reports)).toBe(false);
    expect(triggerRegistry.getTriggers(OtherApplication.prototype).size).toBe(1);
  });

  it("ignores non-class tokens and produces an empty manifest without adopting global cron registrations", () => {
    class Unselected {
      @Cron("0 12 * * SUN")
      run() {}
    }
    const definition = provider(Unselected, "unused");
    const applicationGraph = graph([
      { ...definition, token: new Token("configuration"), tokenId: "config" },
      { ...definition, token: "string-token", tokenId: "string" },
      { ...definition, token: Symbol("symbol-token"), tokenId: "symbol" },
    ]);

    expect(compileCloudflareCrons(applicationGraph)).toEqual({
      schemaVersion: "croco.cloudflare-crons.v1",
      graphInputHash: "app-source-hash",
      crons: [],
      bindings: [],
    });
  });

  it.each(["", " \t"])("rejects blank binding name %s", (name) => {
    class Job {
      @Cron("0 8 * * *", { name })
      run() {}
    }
    expect(() => compileCloudflareCrons(graph([provider(Job, "job")]))).toThrow(
      expect.objectContaining({ code: "CLOUDFLARE_CRON_UNSUPPORTED" }),
    );
  });

  it("rejects duplicate binding names across selected providers", () => {
    class First {
      @Cron("0 8 * * *", { name: "same-id" })
      run() {}
    }
    class Second {
      @Cron("0 17 * * *", { name: "same-id" })
      run() {}
    }
    expect(() =>
      compileCloudflareCrons(graph([provider(First, "first"), provider(Second, "second")])),
    ).toThrow(expect.objectContaining({ code: "CLOUDFLARE_CRON_UNSUPPORTED", status: 400 }));
  });

  it("rejects symbol methods and metadata that does not target an instance method", () => {
    const key = Symbol("job");
    class SymbolJob {
      @Cron("0 * * * *")
      [key]() {}
    }
    expect(() => compileCloudflareCrons(graph([provider(SymbolJob, "symbol-job")]))).toThrow(
      expect.objectContaining({ code: "CLOUDFLARE_CRON_UNSUPPORTED" }),
    );
    class MissingMethod {}
    triggerRegistry.register({
      type: "cron",
      target: MissingMethod.prototype,
      methodName: "missing",
      expression: "0 * * * *",
    });
    expect(() =>
      compileCloudflareCrons(graph([provider(MissingMethod, "missing-method")])),
    ).toThrow(expect.objectContaining({ code: "CLOUDFLARE_CRON_UNSUPPORTED" }));
  });

  it("rejects invalid class targets before reading their registry", () => {
    class Job {}
    const invalid = (() => ({})) as unknown as new () => object;
    expect(() =>
      compileCloudflareCrons(graph([{ ...provider(Job, "invalid"), token: invalid }])),
    ).toThrow(expect.objectContaining({ code: "CLOUDFLARE_CRON_UNSUPPORTED" }));
  });

  it("rejects enabled static Cron methods instead of silently dropping them", () => {
    class StaticJob {
      @Cron("0 * * * *")
      static run() {}
    }
    expect(() => compileCloudflareCrons(graph([provider(StaticJob, "static-job")]))).toThrow(
      expect.objectContaining({ code: "CLOUDFLARE_CRON_UNSUPPORTED" }),
    );
  });

  it("rejects non-UTC timezone declarations from cron metadata", () => {
    class LocalJob {
      @Cron("0 8 * * *", { timezone: "Asia/Seoul" })
      run() {}
    }
    expect(() => compileCloudflareCrons(graph([provider(LocalJob, "local-job")]))).toThrow(
      expect.objectContaining({ code: "CLOUDFLARE_CRON_UNSUPPORTED" }),
    );
  });
});

describe("Cloudflare native cron normalization", () => {
  it.each([
    [" \t17  8 * jan mon-fri\n", "17 8 * JAN MON-FRI"],
    ["*/13 8-17/3 1,15 JAN,aug SUN-SAT/2", "*/13 8-17/3 1,15 JAN,AUG SUN-SAT/2"],
    ["0/17 0,23 1-31 1-12 1-7", "0/17 0,23 1-31 1-12 1-7"],
    ["59 23 31 DEC SAT", "59 23 31 DEC SAT"],
    ["0 0 1 JAN SUN", "0 0 1 JAN SUN"],
  ])("normalizes supported UTC input %s", (expression, expected) => {
    expect(normalizeCloudflareCron(expression)).toBe(expected);
    expect(normalizeCloudflareCron(expression, "UTC")).toBe(expected);
  });

  it("preserves native numeric Sunday=1 and Saturday=7 without translating cron dialects", () => {
    expect(normalizeCloudflareCron("0 17 * * 1")).toBe("0 17 * * 1");
    expect(normalizeCloudflareCron("0 17 * * 7")).toBe("0 17 * * 7");
    expect(() => normalizeCloudflareCron("0 17 * * 0")).toThrow(
      expect.objectContaining({ code: "CLOUDFLARE_CRON_UNSUPPORTED" }),
    );
  });

  it.each([
    "",
    "* * * *",
    "0 * * * * *",
    "@daily",
    "60 * * * *",
    "* 24 * * *",
    "* * 0 * *",
    "* * * 13 *",
    "* * * * 8",
    "* * * JAX *",
    "* * * * MONDAY",
    "*/0 * * * *",
    "*/-1 * * * *",
    "*/1.5 * * * *",
    "*/61 * * * *",
    "*/ * * * *",
    "*//2 * * * *",
    "9-2 * * * *",
    "1- * * * *",
    "1-2-3 * * * *",
    "1,,2 * * * *",
    "1,*x * * * *",
    "* * L * *",
    "* * 1W * *",
    "* * * * MON#2",
    "* * ? * *",
  ])("rejects unsupported or invalid expression %s with a stable Problem", (expression) => {
    expect(() => normalizeCloudflareCron(expression)).toThrow(
      expect.objectContaining({ code: "CLOUDFLARE_CRON_UNSUPPORTED", status: 400 }),
    );
  });

  it.each(["Asia/Seoul", "Etc/UTC", "utc", ""])("rejects unsupported timezone %s", (timezone) => {
    expect(() => normalizeCloudflareCron("0 * * * *", timezone)).toThrow(
      expect.objectContaining({ code: "CLOUDFLARE_CRON_UNSUPPORTED" }),
    );
  });
});
