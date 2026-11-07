import "reflect-metadata";
import { readFileSync } from "node:fs";
import { createApplicationRuntime } from "@croco/framework-module";
import type { ApplicationRuntime } from "@croco/framework-module";
import { ProblemFactory } from "@croco/problems-core";
import type { Problem } from "@croco/problems-core";
import { generatedDiGraph } from "../../.croco/di.generated";

type Entry = {
  application: ApplicationRuntime;
  active: number;
  drained?: () => void;
};
type Development = {
  revision: string;
  entries: Map<object, Entry>;
  cleanup: Promise<void>;
};

const developmentKey = Symbol.for("croco.next.di.development");
const developmentGlobal = globalThis as typeof globalThis & {
  [developmentKey]?: Map<string, Development>;
};
let production: ApplicationRuntime | undefined;

function unavailable(): Problem {
  return ProblemFactory.internalServerError(
    "CROCO_DI_DEVELOPMENT_UNAVAILABLE",
    "The development DI graph is rebuilding, invalid or stale. Correct the compiler diagnostic and retry.",
  );
}

function currentRevision(stateFile: string): string {
  const state: unknown = JSON.parse(readFileSync(stateFile, "utf8"));
  if (
    !state ||
    typeof state !== "object" ||
    !("status" in state) ||
    state.status !== "ready" ||
    !("inputHash" in state) ||
    state.inputHash !== generatedDiGraph.inputHash ||
    !("revision" in state) ||
    typeof state.revision !== "string"
  )
    throw unavailable();
  return state.revision;
}

async function developmentEntry(stateFile: string): Promise<Entry> {
  const revision = currentRevision(stateFile);
  developmentGlobal[developmentKey] ??= new Map();
  const applications = developmentGlobal[developmentKey];
  let development = applications.get(stateFile);
  if (!development) {
    development = {
      revision,
      entries: new Map(),
      cleanup: Promise.resolve(),
    };
    applications.set(stateFile, development);
  }
  if (development.revision !== revision) {
    const retired = [...development.entries.values()];
    development.entries.clear();
    development.revision = revision;
    development.cleanup = development.cleanup.then(async () => {
      const results = await Promise.allSettled(
        retired.map(async (entry) => {
          if (entry.active > 0)
            await new Promise<void>((resolve) => {
              entry.drained = resolve;
            });
          await entry.application.dispose();
        }),
      );
      const failed = results.find((result) => result.status === "rejected");
      if (failed?.status === "rejected") throw failed.reason;
    });
  }
  await development.cleanup;
  if (currentRevision(stateFile) !== revision) throw unavailable();
  let entry = development.entries.get(generatedDiGraph);
  if (!entry) {
    entry = { application: createApplicationRuntime({}, generatedDiGraph), active: 0 };
    development.entries.set(generatedDiGraph, entry);
  }
  return entry;
}

/** Each callback enters this application's scope; edits drain and dispose older revisions. */
export async function withApplication<T>(
  callback: (application: ApplicationRuntime) => T | Promise<T>,
): Promise<T> {
  const stateFile =
    process.env.NODE_ENV === "development" ? process.env.CROCO_DI_DEV_STATE : undefined;
  if (process.env.NODE_ENV === "development" && !stateFile) throw unavailable();
  if (!stateFile) {
    production ??= createApplicationRuntime({}, generatedDiGraph);
    const application = production;
    return application.run(() => callback(application));
  }
  const entry = await developmentEntry(stateFile);
  entry.active++;
  try {
    return await entry.application.run(() => callback(entry.application));
  } finally {
    entry.active--;
    if (entry.active === 0) entry.drained?.();
  }
}
